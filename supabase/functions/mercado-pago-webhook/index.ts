import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, insertEvent, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import { getOrder, mapMercadoPagoStatus, mercadoPagoExternalReference, verifyMercadoPagoSignature } from "../_shared/mercadoPago.ts";

function extractDataId(url: URL, body: Record<string, unknown>) {
  const data = (body.data || {}) as Record<string, unknown>;
  return String(
    data.id
    || body["data.id"]
    || body.data_id
    || body.id
    || url.searchParams.get("data.id")
    || url.searchParams.get("data_id")
    || url.searchParams.get("id")
    || "",
  ).trim();
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

    if (!dataId) return ok(request, { ignored: true, reason: "Evento sem data id." });

    const signatureOk = await verifyMercadoPagoSignature({
      signatureHeader: signature,
      requestId,
      dataId,
    });

    if (!signatureOk) return fail(request, "Assinatura invalida.", 401);

    const order = await getOrder(dataId);
    const externalReference = mercadoPagoExternalReference(order);
    const providerPaymentId = String(order.id || dataId);
    const mappedStatus = mapMercadoPagoStatus(order.status || order.status_detail);

    let planPayment = externalReference
      ? await getSingle(`/arena_plan_payments?id=eq.${encodeURIComponent(externalReference)}&limit=1`)
      : null;

    if (!planPayment) {
      planPayment = await getSingle(`/arena_plan_payments?mercado_pago_order_id=eq.${encodeURIComponent(providerPaymentId)}&limit=1`);
    }

    if (planPayment) {
      const planEventId = requestId || `mp-plan:${dataId}:${order.status || "status"}`;
      const planMetadata = {
        provider: "mercado_pago",
        notification: body,
        order,
        processedAt: new Date().toISOString(),
      };

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
      order,
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
