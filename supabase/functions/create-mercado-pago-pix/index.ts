import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, insertEvent, supabaseRest, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import { createPixOrder, extractPixPayload, mapMercadoPagoStatus, mercadoPagoOrderId } from "../_shared/mercadoPago.ts";
import { readJson, requireUuid } from "../_shared/validation.ts";
import { canGenerateArenaPix } from "../_shared/arenaPaymentStatus.ts";

function pixExpirationDuration(expiresAt: unknown) {
  if (!expiresAt) return "";
  const expiresAtMs = new Date(String(expiresAt)).getTime();
  if (!Number.isFinite(expiresAtMs)) return "";
  const remainingMs = expiresAtMs - Date.now();
  const remainingMinutes = Math.floor(remainingMs / 60000);
  if (remainingMinutes <= 0) return "";
  return `PT${remainingMinutes}M`;
}

function metadataWithPix(metadata: Record<string, unknown> = {}) {
  const pix = (metadata.pix || {}) as Record<string, unknown>;
  return Boolean(pix.pixCopyPaste || pix.qrCodeBase64 || pix.ticketUrl);
}

function logPixCheckpoint(label: string, data: Record<string, unknown> = {}) {
  console.log("[create-mercado-pago-pix]", label, JSON.stringify(data));
}

function paymentDebug(payment: Record<string, unknown> | null, reservation: Record<string, unknown> | null) {
  return {
    paymentId: payment?.id || null,
    paymentStatus: payment?.status || null,
    paymentReservationId: payment?.reservation_id || null,
    paymentProvider: payment?.provider || null,
    paymentProviderPaymentId: payment?.provider_payment_id || null,
    paymentExpiresAt: payment?.expires_at || null,
    reservationId: reservation?.id || null,
    reservationStatus: reservation?.status || null,
    reservationActivePaymentId: reservation?.active_payment_id || null,
    reservationExpiresAt: reservation?.expires_at || null,
  };
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") {
      logPixCheckpoint("error_method_not_allowed", { method: request.method });
      return fail(request, "Metodo nao permitido.", 405);
    }

    const payload = await readJson(request);
    const paymentId = payload.paymentId ? requireUuid(payload.paymentId, "paymentId") : "";
    const reservationId = payload.reservationId ? requireUuid(payload.reservationId, "reservationId") : "";
    if (!paymentId && !reservationId) {
      logPixCheckpoint("error_missing_identifiers", { payloadKeys: Object.keys(payload || {}) });
      return fail(request, "Informe paymentId ou reservationId.");
    }

    logPixCheckpoint("request_received", { paymentId, reservationId });

    let reservation = reservationId
      ? await getSingle(`/arena_reservations?id=eq.${encodeURIComponent(reservationId)}&limit=1`)
      : null;

    let payment = reservation?.active_payment_id
      ? await getSingle(`/arena_payments?id=eq.${encodeURIComponent(String(reservation.active_payment_id))}&limit=1`)
      : paymentId
        ? await getSingle(`/arena_payments?id=eq.${encodeURIComponent(paymentId)}&limit=1`)
        : null;

    logPixCheckpoint("records_loaded", paymentDebug(payment, reservation));

    if (!payment) {
      logPixCheckpoint("error_payment_not_found", { paymentId, reservationId });
      return fail(request, "Pagamento nao encontrado.", 404);
    }

    if (!reservation && payment.reservation_id) {
      reservation = await getSingle(`/arena_reservations?id=eq.${encodeURIComponent(String(payment.reservation_id))}&limit=1`);
    }

    logPixCheckpoint("linked_records_resolved", paymentDebug(payment, reservation));

    if (!reservation) {
      logPixCheckpoint("error_reservation_not_found", paymentDebug(payment, reservation));
      return fail(request, "Reserva vinculada ao pagamento nao encontrada.", 404);
    }

    const validation = canGenerateArenaPix(payment, reservation);
    if (!validation.ok) {
      logPixCheckpoint("error_pix_validation_failed", {
        ...paymentDebug(payment, reservation),
        validation,
      });
      return fail(request, validation.message, 409, validation.details);
    }

    const expirationTime = pixExpirationDuration(payment.expires_at || reservation.expires_at);
    if (!expirationTime) {
      logPixCheckpoint("error_pre_reservation_expired", paymentDebug(payment, reservation));
      await supabaseRpc("expire_arena_payment", { p_payment_id: payment.id });
      return fail(request, "Pre-reserva expirada. Escolha outro horario.", 409);
    }

    const currentMetadata = (payment.metadata || {}) as Record<string, unknown>;
    if (String(payment.provider || "") === "mercado_pago" && metadataWithPix(currentMetadata)) {
      logPixCheckpoint("existing_pix_returned", paymentDebug(payment, reservation));
      return ok(request, {
        payment,
        reservation,
        pix: currentMetadata.pix || {},
      });
    }

    const idempotencyKey = `${payment.id}-${Date.now()}-${crypto.randomUUID()}`;
    logPixCheckpoint("creating_mercado_pago_order", {
      ...paymentDebug(payment, reservation),
      expirationTime,
      idempotencyKey,
    });
    const order = await createPixOrder({ payment, reservation, idempotencyKey, expirationTime });
    const pix = extractPixPayload(order);
    const providerPaymentId = mercadoPagoOrderId(order);
    const nextStatus = mapMercadoPagoStatus(order.status || order.status_detail || "pending");
    const nextMetadata = {
      ...currentMetadata,
      mercadoPagoOrder: order,
      pix,
      pixGeneratedAt: new Date().toISOString(),
    };

    const updatedRows = await supabaseRest(`/arena_payments?id=eq.${encodeURIComponent(String(payment.id))}`, {
      method: "PATCH",
      body: JSON.stringify({
        provider: "mercado_pago",
        provider_payment_id: providerPaymentId || null,
        provider_reference: String(order.external_reference || payment.id),
        status: nextStatus,
        metadata: nextMetadata,
      }),
    });

    const updatedPayment = Array.isArray(updatedRows) ? updatedRows[0] || payment : payment;
    await insertEvent({
      payment_id: payment.id,
      provider: "mercado_pago",
      provider_event_id: `${payment.id}:order-created:${providerPaymentId || Date.now()}`,
      event_type: "payment.pix_created",
      event_status: nextStatus,
      payload: order,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    return ok(request, {
      payment: updatedPayment,
      reservation,
      pix,
    });
  } catch (error) {
    console.error("create-mercado-pago-pix", error);
    return fail(request, error instanceof Error ? error.message : "Falha ao gerar Pix.", 500);
  }
});
