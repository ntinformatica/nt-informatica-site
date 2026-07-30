import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import {
  getOrder,
  mapMercadoPagoStatus,
  MercadoPagoHttpError,
  mercadoPagoExternalReference,
  mercadoPagoPaymentMethod,
  mercadoPagoPaymentTransaction,
  mercadoPagoPaymentTransactionId,
  mercadoPagoOrderId,
  sanitizeMercadoPagoPayload,
  verifyMercadoPagoSignature,
} from "../_shared/mercadoPago.ts";

type JsonObject = Record<string, unknown>;

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function fromRows(rows: unknown) {
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function extractDataId(url: URL, body: JsonObject) {
  const data = (body.data || {}) as JsonObject;
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

function storeStatusFromMercadoPago(mappedStatus: string, rawStatus: unknown) {
  const normalizedRawStatus = cleanText(rawStatus).toLowerCase();
  if (normalizedRawStatus === "charged_back") return "charged_back";
  if (mappedStatus === "paid") return "approved";
  if (mappedStatus === "failed") return "rejected";
  if (mappedStatus === "cancelled") return "cancelled";
  if (mappedStatus === "expired") return "expired";
  if (mappedStatus === "refunded") return "refunded";
  if (mappedStatus === "processing") return "processing";
  return "pending";
}

function isApprovedStatus(status: string) {
  return status === "approved";
}

function isNonApprovedFinalStatus(status: string) {
  return ["cancelled", "rejected", "expired", "refunded", "charged_back"].includes(status);
}

function paymentTypeFromMethod(method: JsonObject, currentType: unknown) {
  const type = cleanText(method.type).toLowerCase();
  if (type === "credit_card") return "credit_card";
  if (type === "bank_transfer" || cleanText(method.id).toLowerCase() === "pix") return "bank_transfer";
  return cleanText(currentType);
}

function eventTypeForStatus(status: string) {
  if (status === "approved") return "store_payment.approved_webhook";
  if (status === "processing") return "store_payment.processing_webhook";
  if (status === "pending") return "store_payment.pending_webhook";
  return `store_payment.${status}_webhook`;
}

function stableEventId(params: {
  dataId: string;
  notificationId: string;
  action: string;
  type: string;
  providerOrderId: string;
  transactionId: string;
  status: string;
}) {
  const source = params.notificationId || params.dataId;
  const eventKind = params.action || params.type || "unknown";
  const paymentRef = params.transactionId || params.providerOrderId || params.dataId;
  return `mp-store:${source}:${eventKind}:${paymentRef}:${params.status}`;
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

  return null;
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const url = new URL(request.url);
    const bodyText = await request.text();
    let body: JsonObject = {};

    if (bodyText.trim()) {
      try {
        body = JSON.parse(bodyText) as JsonObject;
      } catch {
        return fail(request, "JSON invalido.", 400);
      }
    }

    const dataId = extractDataId(url, body);
    const requestId = request.headers.get("x-request-id") || "";
    const signature = request.headers.get("x-signature") || "";

    if (!dataId) return ok(request, { ignored: true, reason: "Evento sem data id." });

    const signatureOk = await verifyMercadoPagoSignature({
      signatureHeader: signature,
      requestId,
      dataId,
    });

    if (!signatureOk) return fail(request, "Assinatura invalida.", 401);

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
    const providerOrderId = mercadoPagoOrderId(order) || dataId;
    const transaction = mercadoPagoPaymentTransaction(order) || {};
    const transactionId = mercadoPagoPaymentTransactionId(order);
    const paymentMethod = mercadoPagoPaymentMethod(order);
    const rawStatus = transaction.status || transaction.status_detail || order.status || order.status_detail;
    const mappedStatus = mapMercadoPagoStatus(rawStatus);
    const storeStatus = storeStatusFromMercadoPago(mappedStatus, rawStatus);
    const statusDetail = cleanText(transaction.status_detail || order.status_detail || rawStatus || mappedStatus);
    const eventId = stableEventId({
      dataId,
      notificationId: cleanText(body.id),
      action: cleanText(body.action),
      type: cleanText(body.type),
      providerOrderId,
      transactionId,
      status: storeStatus,
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

    if (!payment) {
      await insertStorePaymentEvent({
        payment_id: null,
        provider: "mercado_pago",
        provider_event_id: `${eventId}:unknown`,
        event_type: "store_payment.unknown",
        event_status: storeStatus,
        payload: metadata,
        processed: false,
        processing_error: "Pagamento interno nao encontrado.",
      });
      return ok(request, {
        ignored: true,
        reason: "Pagamento interno nao encontrado.",
        providerPaymentId: providerOrderId,
        status: storeStatus,
      });
    }

    const snapshot = {
      mercado_pago_order_id: providerOrderId || payment.mercado_pago_order_id || null,
      mercado_pago_payment_id: transactionId || payment.mercado_pago_payment_id || providerOrderId || null,
      mercado_pago_transaction_id: transactionId || payment.mercado_pago_transaction_id || null,
      payment_type: paymentTypeFromMethod(paymentMethod, payment.payment_type),
      status: isApprovedStatus(storeStatus) ? payment.status || "pending" : storeStatus,
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
      event_type: eventTypeForStatus(storeStatus),
      event_status: storeStatus,
      payload: metadata,
      processed: !isApprovedStatus(storeStatus),
      processed_at: !isApprovedStatus(storeStatus) ? new Date().toISOString() : null,
    });

    let confirmation = null;
    if (isApprovedStatus(storeStatus)) {
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
    } else if (isNonApprovedFinalStatus(storeStatus)) {
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
      processed: isApprovedStatus(storeStatus),
      paymentId: payment.id,
      orderId: payment.order_id,
      providerPaymentId: providerOrderId,
      transactionId,
      status: storeStatus,
      confirmation: fromRows(confirmation),
    });
  } catch (error) {
    console.error("store-payment-webhook", error instanceof Error ? error.message : error);
    return fail(request, error instanceof Error ? error.message : "Falha no webhook de pagamento da loja.", 500);
  }
});
