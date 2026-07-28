export const arenaInitialPaymentStatuses = ["created", "pending", "processing"];
export const arenaFinalPaymentStatuses = ["paid", "failed", "cancelled", "expired", "partially_refunded", "refunded"];
export const arenaPixReservationStatuses = ["pendente_pagamento"];

export function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function canGenerateArenaPix(payment: Record<string, unknown>, reservation: Record<string, unknown>) {
  const paymentStatus = normalizeStatus(payment.status);
  const reservationStatus = normalizeStatus(reservation.status);
  const paymentId = String(payment.id || "");
  const paymentReservationId = String(payment.reservation_id || "");
  const reservationId = String(reservation.id || "");
  const activePaymentId = String(reservation.active_payment_id || "");

  console.log("[arenaPaymentStatus] validating_pix_generation", JSON.stringify({
    paymentId,
    paymentStatus,
    paymentReservationId,
    reservationId,
    reservationStatus,
    activePaymentId,
  }));

  if (!arenaInitialPaymentStatuses.includes(paymentStatus)) {
    console.log("[arenaPaymentStatus] invalid_payment_status", JSON.stringify({
      paymentId,
      paymentStatus,
      isFinalStatus: arenaFinalPaymentStatuses.includes(paymentStatus),
      initialStatuses: arenaInitialPaymentStatuses,
      finalStatuses: arenaFinalPaymentStatuses,
    }));
    return {
      ok: false,
      message: arenaFinalPaymentStatuses.includes(paymentStatus)
        ? "Este pagamento ja esta em estado final."
        : "Este pagamento nao pode gerar Pix.",
      details: { paymentStatus },
    };
  }

  if (!arenaPixReservationStatuses.includes(reservationStatus)) {
    console.log("[arenaPaymentStatus] invalid_reservation_status", JSON.stringify({
      paymentId,
      reservationId,
      reservationStatus,
      expectedReservationStatuses: arenaPixReservationStatuses,
    }));
    return {
      ok: false,
      message: "Esta reserva nao esta aguardando pagamento online.",
      details: { reservationStatus },
    };
  }

  if (!paymentReservationId || !reservationId || paymentReservationId !== reservationId) {
    console.log("[arenaPaymentStatus] invalid_payment_reservation_link", JSON.stringify({
      paymentId,
      paymentReservationId,
      reservationId,
    }));
    return {
      ok: false,
      message: "Pagamento nao pertence a esta reserva.",
      details: { paymentReservationId, reservationId },
    };
  }

  if (!activePaymentId || activePaymentId !== paymentId) {
    console.log("[arenaPaymentStatus] invalid_active_payment_link", JSON.stringify({
      paymentId,
      reservationId,
      activePaymentId,
    }));
    return {
      ok: false,
      message: "Pagamento nao corresponde ao pagamento ativo da reserva.",
      details: { activePaymentId, paymentId },
    };
  }

  console.log("[arenaPaymentStatus] pix_generation_allowed", JSON.stringify({
    paymentId,
    paymentStatus,
    reservationId,
    reservationStatus,
  }));

  return {
    ok: true,
    message: "",
    details: { paymentStatus, reservationStatus },
  };
}

export function isFinalArenaPaymentStatus(status: unknown) {
  return arenaFinalPaymentStatuses.includes(normalizeStatus(status));
}
