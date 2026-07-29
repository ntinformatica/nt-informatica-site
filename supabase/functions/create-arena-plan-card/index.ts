import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { supabaseRest, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import {
  createPlanCardOrder,
  mapMercadoPagoStatus,
  mercadoPagoOrderId,
  mercadoPagoPaymentMethod,
  mercadoPagoPaymentTransaction,
  mercadoPagoPaymentTransactionId,
  sanitizeMercadoPagoPayload,
} from "../_shared/mercadoPago.ts";
import { readJson } from "../_shared/validation.ts";

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function fromRows(rows: unknown) {
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function nested(input: Record<string, unknown>, path: string[]) {
  let current: unknown = input;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function unwrapCardPayload(input: Record<string, unknown>) {
  const formData = input.formData;
  if (formData && typeof formData === "object") return formData as Record<string, unknown>;
  const paymentData = input.paymentData;
  if (paymentData && typeof paymentData === "object") return paymentData as Record<string, unknown>;
  return input;
}

function firstText(values: unknown[]) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function safeInstallments(value: unknown) {
  const installments = Number(value || 1);
  if (!Number.isInteger(installments) || installments <= 0 || installments > 24) return 1;
  return installments;
}

function maskedDocument(value: unknown) {
  const digits = normalizePhone(value);
  if (!digits) return "";
  return digits.length <= 4 ? digits : `***${digits.slice(-4)}`;
}

function maskEmail(value: string) {
  if (!value || !value.includes("@")) return "";
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function debugBrickPayloadEnabled() {
  return String(Deno.env.get("DEBUG_ARENA_CARD_PAYMENT") || "").toLowerCase() === "true";
}

function failureStatus(status: string) {
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "refunded";
  if (status === "expired") return "expired";
  return "rejected";
}

function safePlanPayment(payment: Record<string, unknown> = {}) {
  return {
    id: payment.id,
    customer_name: payment.customer_name,
    customer_phone: payment.customer_phone,
    plan_identifier: payment.plan_identifier,
    plan_name: payment.plan_name,
    amount: payment.amount,
    purchased_hours: payment.purchased_hours,
    purchased_minutes: payment.purchased_minutes,
    validity_days: payment.validity_days,
    status: payment.status,
    payment_method: payment.payment_method,
    payment_type: payment.payment_type,
    installments: payment.installments,
    card_brand: payment.card_brand,
    card_last_four: payment.card_last_four,
    mercado_pago_order_id: payment.mercado_pago_order_id,
    mercado_pago_payment_id: payment.mercado_pago_payment_id,
    mercado_pago_transaction_id: payment.mercado_pago_transaction_id,
    expires_at: payment.expires_at,
    approved_at: payment.approved_at,
    paid_at: payment.paid_at,
    failure_reason: payment.failure_reason,
    subscription_id: payment.subscription_id,
  };
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    await supabaseRpc("expire_arena_plan_payments", {});

    const payload = await readJson(request) as Record<string, unknown>;
    const rawCardPayload = (payload.card || payload.formData || payload.paymentData || payload) as Record<string, unknown>;
    const cardPayload = unwrapCardPayload(rawCardPayload);
    const planIdentifier = cleanText(payload.planId || payload.planIdentifier).toLowerCase();
    const customerPhone = cleanText(payload.customerPhone || payload.whatsapp || nested(cardPayload, ["payer", "phone", "number"]));
    const normalizedPhone = normalizePhone(customerPhone);
    const payer = (cardPayload.payer || {}) as Record<string, unknown>;
    const customerName = firstText([
      payload.customerName,
      payer.first_name,
      payer.name,
      cardPayload.cardholderName,
      nested(cardPayload, ["cardholder", "name"]),
      "Cliente NT",
    ]).slice(0, 80);
    const payerEmail = normalizeEmail(firstText([
      payload.payerEmail,
      payload.email,
      payer.email,
      cardPayload.email,
    ]));
    const payerDocument = maskedDocument(firstText([
      payload.payerDocument,
      nested(payer, ["identification", "number"]),
      nested(cardPayload, ["identification", "number"]),
    ]));
    const token = firstText([cardPayload.token, cardPayload.cardToken, nested(cardPayload, ["payment_method", "token"])]);
    const paymentMethodId = firstText([
      cardPayload.payment_method_id,
      cardPayload.paymentMethodId,
      nested(cardPayload, ["payment_method", "id"]),
    ]).toLowerCase();
    const paymentTypeId = firstText([
      cardPayload.payment_type_id,
      cardPayload.paymentTypeId,
      nested(cardPayload, ["payment_method", "type"]),
    ]).toLowerCase();
    const installments = safeInstallments(cardPayload.installments || nested(cardPayload, ["payment_method", "installments"]));
    const attemptId = firstText([payload.attemptId, payload.idempotencyAttemptId]);

    if (debugBrickPayloadEnabled()) {
      console.log("create-arena-plan-card brick fields", {
        hasToken: Boolean(token),
        issuerId: firstText([cardPayload.issuer_id, cardPayload.issuerId]),
        paymentMethodId,
        paymentTypeId: paymentTypeId || "(ausente)",
        installments,
        hasPayer: Boolean(cardPayload.payer),
        payerEmail: maskEmail(payerEmail),
        payerDocument: payerDocument ? "***" : "",
      });
    }

    if (!planIdentifier) return fail(request, "Plano obrigatorio.");
    if (!normalizedPhone) return fail(request, "WhatsApp obrigatorio.");
    if (!payerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payerEmail)) return fail(request, "E-mail obrigatorio para pagamento com cartao.");
    if (!token) return fail(request, "Token do cartao nao informado.");
    if (!paymentMethodId) return fail(request, "Bandeira do cartao nao informada.");
    if (paymentTypeId && paymentTypeId !== "credit_card") return fail(request, "Somente cartao de credito e aceito.", 400, { paymentTypeId });

    const idempotencyKey = `arena-plan-card-${planIdentifier}-${normalizedPhone}-${attemptId || crypto.randomUUID()}`;
    const rows = await supabaseRpc("create_arena_plan_card_payment", {
      p_plan_identifier: planIdentifier,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_payer_email: payerEmail,
      p_payer_document: payerDocument,
      p_installments: installments,
      p_idempotency_key: idempotencyKey,
    });
    let planPayment = fromRows(rows) as Record<string, unknown> | null;

    if (!planPayment) return fail(request, "Nao foi possivel criar pagamento do plano.", 500);
    if (String(planPayment.status || "") !== "pending") {
      return fail(request, "Este pagamento de plano nao esta aguardando cartao.", 409, { status: planPayment.status });
    }

    if (planPayment.mercado_pago_order_id) {
      return ok(request, { planPayment: safePlanPayment(planPayment) });
    }

    const mercadoPagoIdempotencyKey = `${planPayment.id}-${Date.now()}-${crypto.randomUUID()}`;
    const order = await createPlanCardOrder({
      planPayment,
      idempotencyKey: mercadoPagoIdempotencyKey,
      cardToken: token,
      paymentMethodId,
      installments,
      payerEmail,
    });
    const sanitizedOrder = sanitizeMercadoPagoPayload(order) as Record<string, unknown>;
    const providerOrderId = mercadoPagoOrderId(order);
    const transaction = mercadoPagoPaymentTransaction(order) || {};
    const transactionId = mercadoPagoPaymentTransactionId(order);
    const method = mercadoPagoPaymentMethod(order);
    const transactionStatus = transaction.status || transaction.status_detail || order.status || order.status_detail || "pending";
    const mappedStatus = mapMercadoPagoStatus(transactionStatus);
    const cardBrand = firstText([method.id, paymentMethodId]);
    const cardLastFour = firstText([
      method.last_four_digits,
      method.last_four,
      method.last4,
      nested(method, ["card", "last_four_digits"]),
    ]).replace(/\D/g, "").slice(-4);

    const updatedRows = await supabaseRest(`/arena_plan_payments?id=eq.${encodeURIComponent(String(planPayment.id))}`, {
      method: "PATCH",
      body: JSON.stringify({
        mercado_pago_order_id: providerOrderId || null,
        mercado_pago_payment_id: transactionId || providerOrderId || null,
        mercado_pago_transaction_id: transactionId || null,
        provider_reference: String(order.external_reference || planPayment.id),
        status: mappedStatus === "paid" ? "pending" : ["failed", "cancelled", "expired", "refunded"].includes(mappedStatus) ? failureStatus(mappedStatus) : "pending",
        payment_method: "card",
        payment_type: "credit_card",
        installments,
        payer_email: payerEmail,
        payer_document: payerDocument || null,
        card_brand: cardBrand || null,
        card_last_four: cardLastFour || null,
        paid_at: mappedStatus === "paid" ? new Date().toISOString() : null,
        failure_reason: ["failed", "cancelled", "expired", "refunded"].includes(mappedStatus) ? String(transaction.status_detail || order.status_detail || mappedStatus) : "",
        raw_response: { mercadoPagoOrder: sanitizedOrder },
        metadata: {
          mercadoPagoOrderId: providerOrderId || "",
          mercadoPagoTransactionId: transactionId || "",
          cardProcessedAt: new Date().toISOString(),
        },
      }),
    });
    planPayment = fromRows(updatedRows) as Record<string, unknown> || planPayment;

    await supabaseRest("/arena_plan_payment_events", {
      method: "POST",
      body: JSON.stringify({
        plan_payment_id: planPayment.id,
        provider: "mercado_pago",
        provider_event_id: `${planPayment.id}:card-order-created:${providerOrderId || transactionId || Date.now()}`,
        event_type: "plan_payment.card_created",
        event_status: mappedStatus,
        payload: sanitizedOrder,
        processed: true,
        processed_at: new Date().toISOString(),
      }),
    }).catch((error) => {
      const message = String(error?.message || "");
      if (!message.includes("duplicate key") && !message.includes("arena_plan_payment_events_provider_event_uidx")) throw error;
    });

    if (mappedStatus === "paid") {
      const confirmedRows = await supabaseRpc("confirm_arena_plan_payment", {
        p_plan_payment_id: planPayment.id,
        p_provider_event_id: `${planPayment.id}:card-sync-approved:${providerOrderId || transactionId || Date.now()}`,
        p_metadata: { provider: "mercado_pago", order: sanitizedOrder, processedAt: new Date().toISOString() },
      });
      planPayment = fromRows(confirmedRows) as Record<string, unknown> || planPayment;
    } else if (["failed", "cancelled", "expired", "refunded"].includes(mappedStatus)) {
      const failedRows = await supabaseRpc("fail_arena_plan_payment", {
        p_plan_payment_id: planPayment.id,
        p_status: failureStatus(mappedStatus),
        p_provider_event_id: `${planPayment.id}:card-sync-${mappedStatus}:${providerOrderId || transactionId || Date.now()}`,
        p_metadata: { provider: "mercado_pago", order: sanitizedOrder, processedAt: new Date().toISOString() },
      });
      planPayment = fromRows(failedRows) as Record<string, unknown> || planPayment;
    }

    return ok(request, {
      planPayment: safePlanPayment(planPayment),
      status: mappedStatus,
    });
  } catch (error) {
    console.error("create-arena-plan-card", error instanceof Error ? error.message : error);
    return fail(request, error instanceof Error ? error.message : "Falha ao processar cartao do plano.", 500);
  }
});
