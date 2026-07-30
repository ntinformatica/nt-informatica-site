import { supabaseRequest } from "../../lib/supabase";

const orderSelect = [
  "*",
  "store_order_items(*)",
  "store_payments(id,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,card_brand,card_last_four,mercado_pago_order_id,mercado_pago_payment_id,approved_at,paid_at,created_at,updated_at)",
  "store_order_logs(id,event_type,previous_financial_status,new_financial_status,previous_operational_status,new_operational_status,message,actor_type,source,created_at,metadata)",
].join(",");

export const storeFinancialLabels = {
  pending: "Aguardando pagamento",
  processing: "Em processamento",
  approved: "Pago",
  rejected: "Recusado",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
  charged_back: "Contestacao",
};

export const storeOperationalLabels = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  separating: "Separando pedido",
  ready_for_pickup: "Pronto para retirada",
  delivered: "Retirado",
  cancelled: "Cancelado",
  manual_review: "Revisao manual",
};

export const storeOperationalFlow = [
  "paid",
  "separating",
  "ready_for_pickup",
  "delivered",
  "cancelled",
];

export function formatStoreMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatStoreDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function paymentLabel(order) {
  if (order?.payment_method === "card") return "Cartao";
  if (order?.payment_method === "pix") return "Pix";
  const payment = order?.store_payments?.[0];
  if (payment?.payment_method === "card") return "Cartao";
  if (payment?.payment_method === "pix") return "Pix";
  return "-";
}

export function orderItemCount(order) {
  return (order?.store_order_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function orderMatchesSearch(order, term) {
  const cleanTerm = String(term || "").trim().toLowerCase();
  if (!cleanTerm) return true;
  const cleanDigits = normalizeDigits(cleanTerm);
  const haystack = [
    order.order_number,
    order.customer_name,
    order.customer_email,
    order.customer_document,
    order.customer_phone,
    order.customer_phone_normalized,
  ].map((value) => String(value || "").toLowerCase());

  if (haystack.some((value) => value.includes(cleanTerm))) return true;
  if (cleanDigits) {
    return [
      order.customer_document,
      order.customer_phone,
      order.customer_phone_normalized,
    ].some((value) => normalizeDigits(value).includes(cleanDigits));
  }
  return false;
}

export async function listStoreOrders() {
  const rows = await supabaseRequest(
    `/store_orders?select=${encodeURIComponent(orderSelect)}&order=created_at.desc&limit=500`,
  );

  return (rows || []).map((order) => ({
    ...order,
    store_order_items: order.store_order_items || [],
    store_payments: (order.store_payments || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    store_order_logs: (order.store_order_logs || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
  }));
}

export async function updateStoreOrderOperationalStatus(order, nextStatus) {
  if (!order?.id) throw new Error("Pedido invalido.");
  if (!storeOperationalFlow.includes(nextStatus)) throw new Error("Status operacional invalido.");

  const now = new Date().toISOString();
  const patch = {
    operational_status: nextStatus,
  };

  if (nextStatus === "paid") {
    patch.pickup_status = "not_ready";
  } else if (nextStatus === "separating") {
    patch.pickup_status = "not_ready";
  } else if (nextStatus === "ready_for_pickup") {
    patch.pickup_status = "ready";
    patch.pickup_ready_at = order.pickup_ready_at || now;
  } else if (nextStatus === "delivered") {
    patch.pickup_status = "picked_up";
    patch.picked_up_at = order.picked_up_at || now;
  } else if (nextStatus === "cancelled") {
    patch.pickup_status = "cancelled";
    patch.cancelled_at = order.cancelled_at || now;
  }

  const [updated] = await supabaseRequest(`/store_orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

  await supabaseRequest("/store_order_logs", {
    method: "POST",
    body: JSON.stringify({
      order_id: order.id,
      event_type: "operational_status_changed",
      previous_operational_status: order.operational_status,
      new_operational_status: nextStatus,
      message: `Status operacional alterado para ${storeOperationalLabels[nextStatus] || nextStatus}.`,
      actor_type: "admin",
      source: "admin",
    }),
  }).catch((error) => {
    console.warn("Nao foi possivel registrar log administrativo do pedido:", error);
  });

  return updated;
}

export async function updateStoreOrderInternalNotes(orderId, notes) {
  if (!orderId) throw new Error("Pedido invalido.");
  const [updated] = await supabaseRequest(`/store_orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      pickup_notes: String(notes || "").trim(),
    }),
  });
  return updated;
}
