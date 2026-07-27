import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, insertEvent, supabaseRest, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import { createPixOrder, extractPixPayload, mapMercadoPagoStatus, mercadoPagoOrderId } from "../_shared/mercadoPago.ts";
import { readJson, requireUuid } from "../_shared/validation.ts";

function paymentStatusAllowsPix(status: string) {
  return ["created", "pending", "processing"].includes(status);
}

function reservationStatusAllowsPix(status: string) {
  return ["pendente_pagamento"].includes(status);
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

function metadataWithPix(metadata: Record<string, unknown> = {}) {
  const pix = (metadata.pix || {}) as Record<string, unknown>;
  return Boolean(pix.pixCopyPaste || pix.qrCodeBase64 || pix.ticketUrl);
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const payload = await readJson(request);
    const paymentId = payload.paymentId ? requireUuid(payload.paymentId, "paymentId") : "";
    const reservationId = payload.reservationId ? requireUuid(payload.reservationId, "reservationId") : "";
    if (!paymentId && !reservationId) return fail(request, "Informe paymentId ou reservationId.");

    let payment = paymentId
      ? await getSingle(`/arena_payments?id=eq.${encodeURIComponent(paymentId)}&limit=1`)
      : null;

    let reservation = reservationId
      ? await getSingle(`/arena_reservations?id=eq.${encodeURIComponent(reservationId)}&limit=1`)
      : null;

    if (!payment && reservation?.active_payment_id) {
      payment = await getSingle(`/arena_payments?id=eq.${encodeURIComponent(String(reservation.active_payment_id))}&limit=1`);
    }

    if (!payment && reservation?.id) {
      payment = await getSingle(`/arena_payments?reservation_id=eq.${encodeURIComponent(String(reservation.id))}&order=created_at.desc&limit=1`);
    }

    if (!payment) return fail(request, "Pagamento nao encontrado.", 404);

    if (!reservation && payment.reservation_id) {
      reservation = await getSingle(`/arena_reservations?id=eq.${encodeURIComponent(String(payment.reservation_id))}&limit=1`);
    }

    if (!reservation) return fail(request, "Reserva vinculada ao pagamento nao encontrada.", 404);

    if (!reservationStatusAllowsPix(String(reservation.status || ""))) {
      return fail(request, "Esta reserva nao esta aguardando pagamento online.", 409, { status: reservation.status });
    }

    if (!paymentStatusAllowsPix(String(payment.status || ""))) {
      return fail(request, "Este pagamento nao pode gerar Pix.", 409, { status: payment.status });
    }

    const expirationTime = pixExpirationDuration(payment.expires_at || reservation.expires_at);
    if (!expirationTime) {
      await supabaseRpc("expire_arena_payment", { p_payment_id: payment.id });
      return fail(request, "Pre-reserva expirada. Escolha outro horario.", 409);
    }

    const currentMetadata = (payment.metadata || {}) as Record<string, unknown>;
    if (String(payment.provider || "") === "mercado_pago" && metadataWithPix(currentMetadata)) {
      return ok(request, {
        payment,
        reservation,
        pix: currentMetadata.pix || {},
      });
    }

    const idempotencyKey = String(payment.idempotency_key || `arena-pix-${payment.id}`);
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
