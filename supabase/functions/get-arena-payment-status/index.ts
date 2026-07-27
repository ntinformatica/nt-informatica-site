import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRpc } from "../_shared/supabaseAdmin.ts";
import { readJson, requireUuid } from "../_shared/validation.ts";

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (!["GET", "POST"].includes(request.method)) return fail(request, "Metodo nao permitido.", 405);

    await supabaseRpc("expire_arena_pending_reservations", {});

    const url = new URL(request.url);
    const payload = request.method === "POST" ? await readJson(request) : {};
    const paymentId = payload.paymentId || url.searchParams.get("paymentId");
    const reservationId = payload.reservationId || url.searchParams.get("reservationId");

    let payment = paymentId
      ? await getSingle(`/arena_payments?id=eq.${encodeURIComponent(requireUuid(paymentId, "paymentId"))}&limit=1`)
      : null;

    let reservation = reservationId
      ? await getSingle(`/arena_reservations?id=eq.${encodeURIComponent(requireUuid(reservationId, "reservationId"))}&limit=1`)
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

    return ok(request, {
      payment: {
        id: payment.id,
        status: payment.status,
        paymentMethod: payment.payment_method,
        provider: payment.provider,
        amount: payment.amount,
        currency: payment.currency,
        expiresAt: payment.expires_at,
        paidAt: payment.paid_at,
        cancelledAt: payment.cancelled_at,
        expiredAt: payment.expired_at,
        refundedAt: payment.refunded_at,
        metadata: {
          pix: payment.metadata?.pix || null,
        },
      },
      reservation: reservation ? {
        id: reservation.id,
        stationId: reservation.station_id,
        reservationDate: reservation.reservation_date,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        durationMinutes: reservation.duration_minutes,
        totalPrice: reservation.total_price,
        status: reservation.status,
      } : null,
    });
  } catch (error) {
    console.error("get-arena-payment-status", error);
    return fail(request, error instanceof Error ? error.message : "Falha ao consultar pagamento.", 500);
  }
});
