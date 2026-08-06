import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, insertEvent, supabaseRest, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import {
  getOrder,
  mapMercadoPagoStatus,
  MercadoPagoHttpError,
  mercadoPagoExternalReference,
  mercadoPagoOrderId,
  mercadoPagoPaymentMethod,
  mercadoPagoPaymentTransaction,
  mercadoPagoPaymentTransactionId,
  sanitizeMercadoPagoPayload,
  verifyMercadoPagoSignature,
} from "../_shared/mercadoPago.ts";

type JsonObject = Record<string, unknown>;

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeStatus(value: unknown) {
  return cleanText(value).toLowerCase();
}

function fromRows(rows: unknown) {
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function extractDataId(url: URL, body: Record<string, unknown>) {
  const data = (body.data || {}) as Record<string, unknown>;
  return cleanText(
    url.searchParams.get("data.id")
    || url.searchParams.get("data_id")
    || data.id
    || body["data.id"]
    || body.data_id
    || body.id
    || url.searchParams.get("id")
    || "",
  );
}

function hasSignaturePart(signatureHeader: string, partName: string) {
  return signatureHeader.split(",").some((part) => part.trim().startsWith(`${partName}=`));
}

function signatureRejectReason(params: {
  signatureHeader: string;
  requestId: string;
  dataId: string;
  hasSecret: boolean;
}) {
  if (!params.signatureHeader) return "missing_x_signature";
  if (!hasSignaturePart(params.signatureHeader, "ts")) return "missing_signature_timestamp";
  if (!hasSignaturePart(params.signatureHeader, "v1")) return "missing_signature_hash";
  if (!params.requestId) return "missing_x_request_id";
  if (!params.dataId) return "missing_data_id";
  if (!params.hasSecret) return "missing_webhook_secret";
  return "signature_mismatch";
}

function storeStatusFromMercadoPago(mappedStatus: string, rawStatus: unknown) {
  const normalizedRawStatus = normalizeStatus(rawStatus);
  if (normalizedRawStatus === "charged_back") return "charged_back";
  if (mappedStatus === "paid") return "approved";
  if (mappedStatus === "failed") return "rejected";
  if (mappedStatus === "cancelled") return "cancelled";
  if (mappedStatus === "expired") return "expired";
  if (mappedStatus === "refunded") return "refunded";
  if (mappedStatus === "processing") return "processing";
  return "pending";
}

function resolveStorePaymentStatus(params: {
  transactionStatus: string;
  transactionStatusDetail: string;
  orderStatus: string;
  orderStatusDetail: string;
  fallbackMappedStatus: string;
}) {
  const {
    transactionStatus,
    transactionStatusDetail,
    orderStatus,
    orderStatusDetail,
    fallbackMappedStatus,
  } = params;
  const transactionValues = [transactionStatus, transactionStatusDetail].filter(Boolean);
  const orderValues = [orderStatus, orderStatusDetail].filter(Boolean);
  const allValues = [...transactionValues, ...orderValues];
  const negativeStatusMap: Record<string, string> = {
    rejected: "rejected",
    failed: "rejected",
    cancelled: "cancelled",
    canceled: "cancelled",
    expired: "expired",
    refunded: "refunded",
    charged_back: "charged_back",
  };
  const intermediateStatusMap: Record<string, string> = {
    processing: "processing",
    in_process: "processing",
    in_mediation: "processing",
    pending_review_manual: "processing",
    action_required: "processing",
    waiting_transfer: "processing",
    pending: "pending",
    created: "pending",
  };
  const approvedStatuses = ["approved", "paid", "accredited"];

  for (const value of allValues) {
    if (negativeStatusMap[value]) return negativeStatusMap[value];
  }

  for (const value of transactionValues) {
    if (intermediateStatusMap[value]) return intermediateStatusMap[value];
  }

  if (transactionStatus === "processed") {
    if (transactionStatusDetail === "accredited") return "approved";
    return "processing";
  }

  if (transactionValues.some((value) => approvedStatuses.includes(value))) return "approved";

  for (const value of orderValues) {
    if (intermediateStatusMap[value]) return intermediateStatusMap[value];
  }

  if (orderStatus === "processed") {
    if (transactionStatusDetail === "accredited") return "approved";
    return "processing";
  }

  if (orderValues.some((value) => approvedStatuses.includes(value))) return "approved";

  return storeStatusFromMercadoPago(fallbackMappedStatus, transactionStatus || transactionStatusDetail || orderStatus || orderStatusDetail);
}

function isApprovedStoreStatus(status: string) {
  return status === "approved";
}

function isNonApprovedFinalStoreStatus(status: string) {
  return ["cancelled", "rejected", "expired", "refunded", "charged_back"].includes(status);
}

function paymentTypeFromMethod(method: JsonObject, currentType: unknown) {
  const type = cleanText(method.type).toLowerCase();
  if (type === "credit_card") return "credit_card";
  if (type === "bank_transfer" || cleanText(method.id).toLowerCase() === "pix") return "bank_transfer";
  return cleanText(currentType);
}

function storeEventTypeForStatus(status: string) {
  if (status === "approved") return "store_payment.approved_webhook";
  if (status === "processing") return "store_payment.processing_webhook";
  if (status === "pending") return "store_payment.pending_webhook";
  return `store_payment.${status}_webhook`;
}

function stableStoreEventId(params: {
  dataId: string;
  notificationId: string;
  action: string;
  type: string;
  providerOrderId: string;
  transactionId: string;
  status: string;
  statusDetail: string;
}) {
  const source = params.notificationId || params.dataId;
  const eventKind = params.action || params.type || "unknown";
  const paymentRef = params.transactionId || params.providerOrderId || params.dataId;
  return `mp-store:${source}:${eventKind}:${paymentRef}:${params.status}:${params.statusDetail || "no-detail"}`;
}

function mercadoPagoOrderErrorResponse(request: Request, error: MercadoPagoHttpError) {
  if (error.status === 401 || error.status === 403) {
    return fail(request, "Falha de credenciais ao consultar Mercado Pago.", 500);
  }
  if (error.status === 404) {
    return fail(request, "Order do Mercado Pago nao encontrada.", 404);
  }
  if (error.status === 429) {
    return fail(request, "Mercado Pago limitou temporariamente a consulta da Order.", 503);
  }
  if (error.status === 504 || error.status >= 500) {
    return fail(request, "Mercado Pago indisponivel ao consultar a Order.", 503);
  }
  return fail(request, "Falha ao consultar Order do Mercado Pago.", 502);
}

async function insertStorePaymentEvent(event: JsonObject) {
  await supabaseRest("/store_payment_events", {
    method: "POST",
    body: JSON.stringify(event),
  }).catch((error) => {
    const message = String(error?.message || "");
    if (!message.includes("duplicate key") && !message.includes("store_payment_events_provider_event_uidx")) throw error;
  });
}

async function patchStorePayment(paymentId: string, values: JsonObject) {
  const rows = await supabaseRest(`/store_payments?id=eq.${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
  return fromRows(rows) as JsonObject | null;
}

async function findStorePayment(params: {
  externalReference: string;
  providerOrderId: string;
  transactionId: string;
}) {
  const { externalReference, providerOrderId, transactionId } = params;

  if (externalReference) {
    const payment = await getSingle(
      `/store_payments?external_reference=eq.${encodeURIComponent(externalReference)}`
      + "&select=id,order_id,provider,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,external_reference,mercado_pago_order_id,mercado_pago_payment_id,mercado_pago_transaction_id,raw_response,metadata,expires_at&limit=1",
    );
    if (payment) return payment as JsonObject;
  }

  if (providerOrderId) {
    const payment = await getSingle(
      `/store_payments?mercado_pago_order_id=eq.${encodeURIComponent(providerOrderId)}`
      + "&select=id,order_id,provider,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,external_reference,mercado_pago_order_id,mercado_pago_payment_id,mercado_pago_transaction_id,raw_response,metadata,expires_at&limit=1",
    );
    if (payment) return payment as JsonObject;
  }

  if (transactionId) {
    const payment = await getSingle(
      `/store_payments?mercado_pago_payment_id=eq.${encodeURIComponent(transactionId)}`
      + "&select=id,order_id,provider,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,external_reference,mercado_pago_order_id,mercado_pago_payment_id,mercado_pago_transaction_id,raw_response,metadata,expires_at&limit=1",
    );
    if (payment) return payment as JsonObject;
  }

  if (transactionId) {
    const payment = await getSingle(
      `/store_payments?mercado_pago_transaction_id=eq.${encodeURIComponent(transactionId)}`
      + "&select=id,order_id,provider,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,external_reference,mercado_pago_order_id,mercado_pago_payment_id,mercado_pago_transaction_id,raw_response,metadata,expires_at&limit=1",
    );
    if (payment) return payment as JsonObject;
  }

  return null;
}

async function processStorePaymentWebhook(params: {
  request: Request;
  body: JsonObject;
  dataId: string;
  requestId: string;
  order: JsonObject;
  sanitizedOrder: JsonObject;
  externalReference: string;
  providerOrderId: string;
  transaction: JsonObject;
  transactionId: string;
  paymentMethod: JsonObject;
  mappedStatus: string;
}) {
  const {
    request,
    body,
    dataId,
    requestId,
    order,
    sanitizedOrder,
    externalReference,
    providerOrderId,
    transaction,
    transactionId,
    paymentMethod,
    mappedStatus,
  } = params;

  const transactionStatus = normalizeStatus(transaction.status);
  const transactionStatusDetail = normalizeStatus(transaction.status_detail);
  const orderStatus = normalizeStatus(order.status);
  const orderStatusDetail = normalizeStatus(order.status_detail);
  const rawStatus = transactionStatus || transactionStatusDetail || orderStatus || orderStatusDetail;
  const storeStatus = resolveStorePaymentStatus({
    transactionStatus,
    transactionStatusDetail,
    orderStatus,
    orderStatusDetail,
    fallbackMappedStatus: mappedStatus,
  });
  const statusDetail = cleanText(transaction.status_detail || order.status_detail || rawStatus || mappedStatus);
  const eventId = stableStoreEventId({
    dataId,
    notificationId: cleanText(body.id),
    action: cleanText(body.action),
    type: cleanText(body.type),
    providerOrderId,
    transactionId,
    status: storeStatus,
    statusDetail,
  });
  const metadata = {
    provider: "mercado_pago",
    notification: body,
    order: sanitizedOrder,
    processedAt: new Date().toISOString(),
    requestId,
  };

  const payment = await findStorePayment({
    externalReference,
    providerOrderId,
    transactionId,
  });

  console.log("[STORE WEBHOOK STATUS RESOLUTION]", {
    dataId,
    externalReference,
    providerOrderId,
    transactionId,
    transactionStatus,
    transactionStatusDetail,
    orderStatus,
    orderStatusDetail,
    storeStatus,
    paymentFound: Boolean(payment),
    confirmStorePaymentCalled: false,
  });

  if (!payment) return null;

  const snapshot = {
    mercado_pago_order_id: providerOrderId || payment.mercado_pago_order_id || null,
    mercado_pago_payment_id: transactionId || payment.mercado_pago_payment_id || providerOrderId || null,
    mercado_pago_transaction_id: transactionId || payment.mercado_pago_transaction_id || null,
    payment_type: paymentTypeFromMethod(paymentMethod, payment.payment_type),
    status: isApprovedStoreStatus(storeStatus) ? payment.status || "pending" : storeStatus,
    status_detail: statusDetail,
    raw_response: {
      ...(typeof payment.raw_response === "object" && payment.raw_response ? payment.raw_response as JsonObject : {}),
      mercadoPagoWebhookOrder: sanitizedOrder,
    },
    metadata: {
      ...(typeof payment.metadata === "object" && payment.metadata ? payment.metadata as JsonObject : {}),
      lastWebhookStatus: storeStatus,
      lastWebhookAt: new Date().toISOString(),
    },
  };

  await patchStorePayment(String(payment.id), snapshot).catch((error) => {
    console.warn("Falha ao atualizar snapshot do pagamento da loja pelo webhook.", error);
  });

  await insertStorePaymentEvent({
    payment_id: payment.id,
    provider: "mercado_pago",
    provider_event_id: `${eventId}:webhook`,
    event_type: storeEventTypeForStatus(storeStatus),
    event_status: storeStatus,
    payload: metadata,
    processed: !isApprovedStoreStatus(storeStatus),
    processed_at: !isApprovedStoreStatus(storeStatus) ? new Date().toISOString() : null,
  });

  let confirmation = null;
  if (isApprovedStoreStatus(storeStatus)) {
    console.log("[STORE WEBHOOK CONFIRM_STORE_PAYMENT]", {
      dataId,
      externalReference,
      providerOrderId,
      transactionId,
      paymentId: payment.id,
      orderId: payment.order_id,
      storeStatus,
      confirmStorePaymentCalled: true,
    });
    try {
      confirmation = await supabaseRpc("confirm_store_payment", {
        p_payment_id: payment.id,
        p_external_reference: externalReference || null,
        p_mercado_pago_payment_id: transactionId || providerOrderId || "",
        p_status: "approved",
        p_status_detail: statusDetail,
        p_provider_event_id: `${eventId}:confirm`,
        p_raw_response: metadata,
        p_idempotency_key: `${eventId}:confirm`,
      });
      const confirmationResult = fromRows(confirmation) as JsonObject | null;
      console.log("[STORE WEBHOOK CONFIRM_STORE_PAYMENT RESULT]", {
        dataId,
        externalReference,
        providerOrderId,
        transactionId,
        paymentId: payment.id,
        orderId: payment.order_id,
        storeStatus,
        result: {
          received: Boolean(confirmationResult),
          idempotent: Boolean(confirmationResult?.idempotent),
          manualReview: Boolean(confirmationResult?.manual_review),
          paymentStatus: cleanText(confirmationResult?.payment_status),
        },
      });
    } catch (error) {
      console.error("[STORE WEBHOOK CONFIRM_STORE_PAYMENT ERROR]", {
        dataId,
        externalReference,
        providerOrderId,
        transactionId,
        paymentId: payment.id,
        orderId: payment.order_id,
        storeStatus,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  } else if (isNonApprovedFinalStoreStatus(storeStatus)) {
    await patchStorePayment(String(payment.id), {
      status: storeStatus,
      status_detail: statusDetail,
      raw_response: {
        ...(typeof payment.raw_response === "object" && payment.raw_response ? payment.raw_response as JsonObject : {}),
        mercadoPagoWebhookOrder: sanitizedOrder,
      },
    }).catch((error) => {
      console.warn("Falha ao atualizar status final nao aprovado do pagamento da loja.", error);
    });
  }

  return ok(request, {
    processed: isApprovedStoreStatus(storeStatus),
    paymentId: payment.id,
    orderId: payment.order_id,
    providerPaymentId: providerOrderId,
    transactionId,
    status: storeStatus,
    confirmation: fromRows(confirmation),
    type: "store",
  });
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const url = new URL(request.url);
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const dataId = extractDataId(url, body);
    const requestId = request.headers.get("x-request-id") || "";
    const signature = request.headers.get("x-signature") || "";
    const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") || "";
    const eventType = cleanText(body.type || body.action || "");

    if (!dataId) return ok(request, { ignored: true, reason: "Evento sem data id." });

    const signatureOk = await verifyMercadoPagoSignature({
      signatureHeader: signature,
      requestId,
      dataId,
    });

    if (!signatureOk) {
      console.log("[Mercado Pago webhook] assinatura rejeitada", {
        hasSignatureHeader: Boolean(signature),
        hasRequestIdHeader: Boolean(requestId),
        hasWebhookSecret: Boolean(webhookSecret),
        webhookSecretLength: webhookSecret.length,
        dataId,
        eventType,
        signatureOk,
        rejectReason: signatureRejectReason({
          signatureHeader: signature,
          requestId,
          dataId,
          hasSecret: Boolean(webhookSecret),
        }),
      });
      return fail(request, "Assinatura invalida.", 401);
    }

    let order: JsonObject;
    try {
      order = await getOrder(dataId) as JsonObject;
    } catch (error) {
      if (error instanceof MercadoPagoHttpError) {
        return mercadoPagoOrderErrorResponse(request, error);
      }
      throw error;
    }

    const sanitizedOrder = sanitizeMercadoPagoPayload(order) as JsonObject;
    const externalReference = mercadoPagoExternalReference(order);
    const providerPaymentId = mercadoPagoOrderId(order) || String(order.id || dataId);
    const transaction = mercadoPagoPaymentTransaction(order) || {};
    const transactionId = mercadoPagoPaymentTransactionId(order);
    const paymentMethod = mercadoPagoPaymentMethod(order);
    const mappedStatus = mapMercadoPagoStatus(transaction.status || transaction.status_detail || order.status || order.status_detail);

    const storeResponse = await processStorePaymentWebhook({
      request,
      body,
      dataId,
      requestId,
      order,
      sanitizedOrder,
      externalReference,
      providerOrderId: providerPaymentId,
      transaction,
      transactionId,
      paymentMethod,
      mappedStatus,
    });
    if (storeResponse) return storeResponse;

    let planPayment = externalReference
      ? await getSingle(`/arena_plan_payments?id=eq.${encodeURIComponent(externalReference)}&limit=1`)
      : null;

    if (!planPayment) {
      planPayment = await getSingle(`/arena_plan_payments?mercado_pago_order_id=eq.${encodeURIComponent(providerPaymentId)}&limit=1`);
    }

    if (planPayment) {
      const planEventId = requestId || `mp-plan:${dataId}:${order.status || "status"}`;
      const planPaymentIsCard = String(planPayment.payment_method || "").toLowerCase() === "card"
        || String(paymentMethod.type || "").toLowerCase() === "credit_card";
      const planMetadata = {
        provider: "mercado_pago",
        notification: body,
        order: sanitizedOrder,
        processedAt: new Date().toISOString(),
      };

      await supabaseRest(`/arena_plan_payments?id=eq.${encodeURIComponent(String(planPayment.id))}`, {
        method: "PATCH",
        body: JSON.stringify({
          mercado_pago_order_id: providerPaymentId || planPayment.mercado_pago_order_id || null,
          mercado_pago_payment_id: transactionId || planPayment.mercado_pago_payment_id || providerPaymentId || null,
          mercado_pago_transaction_id: transactionId || planPayment.mercado_pago_transaction_id || null,
          provider_reference: externalReference || planPayment.provider_reference || String(planPayment.id),
          card_brand: planPaymentIsCard ? paymentMethod.id || planPayment.card_brand || null : planPayment.card_brand || null,
          installments: planPaymentIsCard ? paymentMethod.installments || planPayment.installments || null : planPayment.installments || null,
          paid_at: mappedStatus === "paid" ? new Date().toISOString() : planPayment.paid_at || null,
          failure_reason: mappedStatus === "refunded"
            ? String(transaction.status_detail || order.status_detail || transaction.status || order.status || "refunded_manual_review")
            : planPayment.failure_reason || "",
          raw_response: {
            ...(typeof planPayment.raw_response === "object" && planPayment.raw_response ? (planPayment.raw_response as Record<string, unknown>) : {}),
            mercadoPagoWebhookOrder: sanitizedOrder,
          },
        }),
      }).catch((error) => {
        console.warn("Falha ao atualizar snapshot do pagamento de plano pelo webhook.", error);
      });

      let planRows = null;
      if (mappedStatus === "paid") {
        planRows = await supabaseRpc("confirm_arena_plan_payment", {
          p_plan_payment_id: planPayment.id,
          p_provider_event_id: `${planEventId}:confirm`,
          p_metadata: planMetadata,
        });
      } else if (mappedStatus === "expired") {
        planRows = await supabaseRpc("fail_arena_plan_payment", {
          p_plan_payment_id: planPayment.id,
          p_status: "expired",
          p_provider_event_id: `${planEventId}:expired`,
          p_metadata: planMetadata,
        });
      } else if (mappedStatus === "refunded" && String(planPayment.status || "") === "approved") {
        await supabaseRest("/arena_plan_payment_events", {
          method: "POST",
          body: JSON.stringify({
            plan_payment_id: planPayment.id,
            provider: "mercado_pago",
            provider_event_id: `${planEventId}:refunded-approved`,
            event_type: "plan_payment.refunded_review",
            event_status: "refunded",
            payload: planMetadata,
            processed: true,
            processed_at: new Date().toISOString(),
          }),
        }).catch((error) => {
          const message = String(error?.message || "");
          if (!message.includes("duplicate key") && !message.includes("arena_plan_payment_events_provider_event_uidx")) throw error;
        });
        planRows = [planPayment];
      } else if (["failed", "cancelled", "refunded"].includes(mappedStatus)) {
        planRows = await supabaseRpc("fail_arena_plan_payment", {
          p_plan_payment_id: planPayment.id,
          p_status: mappedStatus === "refunded" ? "refunded" : mappedStatus === "cancelled" ? "cancelled" : "rejected",
          p_provider_event_id: `${planEventId}:${mappedStatus}`,
          p_metadata: planMetadata,
        });
      }

      return ok(request, {
        processed: Boolean(planRows),
        planPaymentId: planPayment.id,
        providerPaymentId,
        status: mappedStatus,
        type: "arena_plan",
      });
    }

    let payment = externalReference
      ? await getSingle(`/arena_payments?id=eq.${encodeURIComponent(externalReference)}&limit=1`)
      : null;

    if (!payment) {
      payment = await getSingle(`/arena_payments?provider=eq.mercado_pago&provider_payment_id=eq.${encodeURIComponent(providerPaymentId)}&limit=1`);
    }

    if (!payment) {
      await insertEvent({
        payment_id: null,
        provider: "mercado_pago",
        provider_event_id: requestId || `mp:${dataId}:unknown`,
        event_type: "payment.unknown",
        event_status: String(order.status || ""),
        payload: { notification: body, order },
        processed: false,
        processing_error: "Pagamento local nao encontrado.",
      });
      return ok(request, { ignored: true, reason: "Pagamento local nao encontrado." });
    }

    const eventId = requestId || `mp:${dataId}:${order.status || "status"}`;
    const metadata = {
      provider: "mercado_pago",
      notification: body,
      order: sanitizedOrder,
      processedAt: new Date().toISOString(),
    };

    await insertEvent({
      payment_id: payment.id,
      provider: "mercado_pago",
      provider_event_id: eventId,
      event_type: "payment.webhook",
      event_status: String(order.status || ""),
      payload: metadata,
      processed: false,
    });

    let rows = null;
    if (mappedStatus === "paid") {
      rows = await supabaseRpc("confirm_arena_payment", {
        p_payment_id: payment.id,
        p_provider_event_id: `${eventId}:confirm`,
        p_metadata: metadata,
        p_manual_reason: "",
      });
    } else if (mappedStatus === "expired") {
      rows = await supabaseRpc("expire_arena_payment", { p_payment_id: payment.id });
    } else if (["failed", "cancelled"].includes(mappedStatus)) {
      rows = await supabaseRpc("fail_arena_payment", {
        p_payment_id: payment.id,
        p_status: mappedStatus,
        p_provider_event_id: `${eventId}:${mappedStatus}`,
        p_metadata: metadata,
      });
    }

    return ok(request, {
      processed: Boolean(rows),
      paymentId: payment.id,
      providerPaymentId,
      status: mappedStatus,
    });
  } catch (error) {
    console.error("mercado-pago-webhook", error);
    return fail(request, error instanceof Error ? error.message : "Falha no webhook Mercado Pago.", 500);
  }
});
