import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import { createPlanPixOrder, extractPixPayload, mapMercadoPagoStatus, mercadoPagoOrderId } from "../_shared/mercadoPago.ts";
import { readJson } from "../_shared/validation.ts";

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function pixExpirationDuration(expiresAt: unknown) {
  if (!expiresAt) return "";
  const expiresAtMs = new Date(String(expiresAt)).getTime();
  if (!Number.isFinite(expiresAtMs)) return "";
  const remainingMs = expiresAtMs - Date.now();
  const remainingMinutes = Math.floor(remainingMs / 60000);
  if (remainingMinutes <= 0) return "";
  return `PT${remainingMinutes}M`;
}

function metadataWithPix(payment: Record<string, unknown> = {}) {
  return Boolean(payment.qr_code || payment.qr_code_base64 || payment.ticket_url);
}

function fromRows(rows: unknown) {
  return Array.isArray(rows) ? rows[0] || null : rows;
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    await supabaseRpc("expire_arena_plan_payments", {});

    const payload = await readJson(request);
    const planIdentifier = String(payload.planId || payload.planIdentifier || "").trim().toLowerCase();
    const customerName = String(payload.customerName || "").trim();
    const customerPhone = String(payload.customerPhone || "").trim();
    const normalizedPhone = normalizePhone(customerPhone);

    if (!planIdentifier) return fail(request, "Plano obrigatorio.");
    if (!customerName) return fail(request, "Nome obrigatorio.");
    if (!normalizedPhone) return fail(request, "WhatsApp obrigatorio.");

    const idempotencyKey = `arena-plan-pix-${planIdentifier}-${normalizedPhone}`;
    const rows = await supabaseRpc("create_arena_plan_payment", {
      p_plan_identifier: planIdentifier,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_idempotency_key: idempotencyKey,
    });
    let planPayment = fromRows(rows) as Record<string, unknown> | null;

    if (!planPayment) return fail(request, "Nao foi possivel criar pagamento do plano.", 500);

    if (String(planPayment.status || "") !== "pending") {
      return fail(request, "Este pagamento de plano nao esta aguardando Pix.", 409, { status: planPayment.status });
    }

    if (metadataWithPix(planPayment)) {
      return ok(request, {
        planPayment,
        pix: {
          pixCopyPaste: planPayment.qr_code || "",
          qrCodeBase64: planPayment.qr_code_base64 || "",
          ticketUrl: planPayment.ticket_url || "",
        },
      });
    }

    const expirationTime = pixExpirationDuration(planPayment.expires_at);
    if (!expirationTime) {
      await supabaseRpc("fail_arena_plan_payment", {
        p_plan_payment_id: planPayment.id,
        p_status: "expired",
        p_provider_event_id: null,
        p_metadata: { reason: "plan_pix_expired_before_order" },
      });
      return fail(request, "Pagamento expirado. Tente gerar um novo Pix.", 409);
    }

    const mercadoPagoIdempotencyKey = `${planPayment.id}-${Date.now()}-${crypto.randomUUID()}`;
    const order = await createPlanPixOrder({ planPayment, idempotencyKey: mercadoPagoIdempotencyKey, expirationTime });
    const pix = extractPixPayload(order);
    const providerPaymentId = mercadoPagoOrderId(order);
    const nextStatus = mapMercadoPagoStatus(order.status || order.status_detail || "pending");

    const updatedRows = await supabaseRest(`/arena_plan_payments?id=eq.${encodeURIComponent(String(planPayment.id))}`, {
      method: "PATCH",
      body: JSON.stringify({
        mercado_pago_order_id: providerPaymentId || null,
        mercado_pago_payment_id: providerPaymentId || null,
        provider_reference: String(order.external_reference || planPayment.id),
        status: nextStatus === "paid" ? "approved" : "pending",
        qr_code: pix.pixCopyPaste || null,
        qr_code_base64: pix.qrCodeBase64 || null,
        ticket_url: pix.ticketUrl || null,
        raw_response: { mercadoPagoOrder: order },
        metadata: {
          mercadoPagoOrderId: providerPaymentId || "",
          pixGeneratedAt: new Date().toISOString(),
        },
      }),
    });

    planPayment = fromRows(updatedRows) as Record<string, unknown> || planPayment;

    await supabaseRest("/arena_plan_payment_events", {
      method: "POST",
      body: JSON.stringify({
        plan_payment_id: planPayment.id,
        provider: "mercado_pago",
        provider_event_id: `${planPayment.id}:order-created:${providerPaymentId || Date.now()}`,
        event_type: "plan_payment.pix_created",
        event_status: "pending",
        payload: order,
        processed: true,
        processed_at: new Date().toISOString(),
      }),
    }).catch((error) => {
      const message = String(error?.message || "");
      if (!message.includes("duplicate key") && !message.includes("arena_plan_payment_events_provider_event_uidx")) throw error;
    });

    return ok(request, { planPayment, pix });
  } catch (error) {
    console.error("create-arena-plan-pix", error);
    return fail(request, error instanceof Error ? error.message : "Falha ao gerar Pix do plano.", 500);
  }
});
