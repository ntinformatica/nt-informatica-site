import { createStorageSignedUrl, supabaseFunction, supabaseRequest, uploadPrivateStorageFile } from "../../lib/supabase";

const orderSelect = [
  "*",
  "store_order_items(*)",
  "store_payments(id,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,card_brand,card_last_four,mercado_pago_order_id,mercado_pago_payment_id,approved_at,paid_at,created_at,updated_at)",
  "store_order_logs(id,event_type,previous_financial_status,new_financial_status,previous_operational_status,new_operational_status,message,actor_type,source,created_at,metadata)",
  "order_billing_snapshots(*)",
  "order_invoices(*)",
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
  paid: "Pagamento confirmado",
  separating: "Separando pedido",
  ready_for_pickup: "Pronto para retirada",
  delivered: "Retirado / Entregue",
  cancelled: "Cancelado",
  manual_review: "Revisao manual",
};

export const storeOperationalOptions = [
  "awaiting_payment",
  "paid",
  "separating",
  "ready_for_pickup",
  "delivered",
  "cancelled",
  "manual_review",
];

export const storeOperationalFlow = [
  "paid",
  "separating",
  "ready_for_pickup",
  "delivered",
  "cancelled",
];

export const storeFiscalLabels = {
  pending: "Aguardando emissao",
  issued: "Nota emitida",
  authorized: "Nota autorizada",
  cancelled: "Nota cancelada",
  not_applicable: "Sem emissao fiscal",
  error: "Problema fiscal",
};

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

export function displayStoreFiscalStatus(order, invoice = null) {
  if (["issued", "authorized"].includes(invoice?.status)) return "issued";
  if (invoice?.status === "cancelled") return "cancelled";
  if (invoice?.status === "error") return "error";
  if (order?.operational_status === "cancelled") return "not_applicable";
  if (["expired", "cancelled", "rejected", "refunded", "charged_back"].includes(order?.financial_status)) return "not_applicable";
  return order?.fiscal_status || "pending";
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

export function allowedStoreOperationalStatuses(order) {
  const current = order?.operational_status || "awaiting_payment";
  let allowed = [];

  if (current === "manual_review") {
    allowed = ["manual_review", "cancelled"];
  } else if (order?.financial_status === "approved") {
    allowed = storeOperationalFlow;
  } else if (["pending", "processing"].includes(order?.financial_status)) {
    allowed = ["awaiting_payment", "cancelled"];
  } else {
    allowed = ["cancelled"];
  }

  return [...new Set([current, ...allowed].filter((status) => storeOperationalOptions.includes(status)))];
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
    order_billing_snapshots: order.order_billing_snapshots || [],
    order_invoices: (order.order_invoices || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
  }));
}

export async function updateStoreOrderOperationalStatus(order, nextStatus) {
  if (!order?.id) throw new Error("Pedido invalido.");
  if (!allowedStoreOperationalStatuses(order).includes(nextStatus)) throw new Error("Transicao operacional nao permitida para este pedido.");

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

export async function sendStoreOrderToBling(orderId) {
  if (!orderId) throw new Error("Pedido invalido.");
  return supabaseFunction("bling-create-order", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  });
}

export async function syncStoreOrderInvoiceFromBling(orderId) {
  if (!orderId) throw new Error("Pedido invalido.");
  return supabaseFunction("bling-sync-order-invoice", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  });
}

function invoiceFilePath(order, kind, file) {
  const safeOrder = String(order?.order_number || order?.id || "pedido").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  const extension = kind === "xml" ? "xml" : "pdf";
  return `${safeOrder}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export function validateInvoiceFiles({ xmlFile, pdfFile }) {
  if (!xmlFile) throw new Error("Anexe o XML autorizado.");
  if (!pdfFile) throw new Error("Anexe o DANFE em PDF.");
  if (!xmlFile.name.toLowerCase().endsWith(".xml")) throw new Error("O arquivo XML precisa ter extensao .xml.");
  if (!["application/xml", "text/xml", ""].includes(xmlFile.type)) throw new Error("O arquivo XML possui MIME type invalido.");
  if (!pdfFile.name.toLowerCase().endsWith(".pdf") || pdfFile.type !== "application/pdf") throw new Error("O DANFE precisa ser um PDF valido.");
  if (xmlFile.size <= 0 || pdfFile.size <= 0) throw new Error("Arquivo fiscal vazio.");
  if (xmlFile.size > 10 * 1024 * 1024 || pdfFile.size > 10 * 1024 * 1024) throw new Error("Arquivos fiscais devem ter no maximo 10 MB.");
}

export async function saveStoreOrderInvoice(order, values) {
  if (!order?.id) throw new Error("Pedido invalido.");
  const accessKey = normalizeDigits(values.accessKey);
  if (accessKey.length !== 44) throw new Error("Chave de acesso deve ter exatamente 44 digitos.");
  validateInvoiceFiles(values);

  const xmlPath = invoiceFilePath(order, "xml", values.xmlFile);
  const pdfPath = invoiceFilePath(order, "danfe", values.pdfFile);
  await uploadPrivateStorageFile("store-invoices", xmlPath, values.xmlFile);
  await uploadPrivateStorageFile("store-invoices", pdfPath, values.pdfFile);

  const payload = {
    order_id: order.id,
    status: "issued",
    invoice_number: String(values.invoiceNumber || "").trim(),
    invoice_series: String(values.invoiceSeries || "").trim(),
    access_key: accessKey,
    issued_at: values.issuedAt ? new Date(values.issuedAt).toISOString() : null,
    xml_storage_path: xmlPath,
    pdf_storage_path: pdfPath,
    xml_original_name: values.xmlFile.name,
    pdf_original_name: values.pdfFile.name,
    xml_mime_type: values.xmlFile.type || "application/xml",
    pdf_mime_type: values.pdfFile.type || "application/pdf",
  };

  const rows = await supabaseRequest("/order_invoices?on_conflict=order_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });

  await supabaseRequest(`/store_orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ fiscal_status: "issued" }),
  });

  await supabaseRequest("/store_order_logs", {
    method: "POST",
    body: JSON.stringify({
      order_id: order.id,
      event_type: "invoice_attached",
      message: `NF-e ${payload.invoice_number || accessKey} anexada pelo administrador.`,
      actor_type: "admin",
      source: "admin",
      metadata: { access_key: accessKey.replace(/^(\d{4}).+(\d{4})$/, "$1***$2") },
    }),
  }).catch((error) => {
    console.warn("Nao foi possivel registrar log da nota fiscal:", error);
  });

  return Array.isArray(rows) ? rows[0] || null : rows;
}

export async function createAdminInvoiceSignedUrl(invoice, kind) {
  const path = kind === "xml" ? invoice?.xml_storage_path : invoice?.pdf_storage_path;
  if (!path) throw new Error("Documento fiscal indisponivel.");
  return createStorageSignedUrl("store-invoices", path, 300);
}
