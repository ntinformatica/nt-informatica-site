import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";

function assertSupabaseReady() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase não configurado. O módulo de Ordem de Serviço exige banco real.");
  }
}

function normalizeJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function fromSupabase(row = {}) {
  return {
    id: row.id || "",
    osNumber: row.os_number || null,
    status: row.status || "Recebido",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    entryDate: row.entry_date || "",
    entryTime: row.entry_time || "",
    customerName: row.customer_name || "",
    customerDocument: row.customer_document || "",
    customerPhone: row.customer_phone || "",
    deviceBrand: row.device_brand || "",
    deviceModel: row.device_model || "",
    deviceColor: row.device_color || "",
    deviceSerialImei: row.device_serial_imei || "",
    devicePassword: row.device_password || "",
    unlockPattern: row.unlock_pattern || "",
    accessories: normalizeJson(row.accessories),
    deviceCondition: normalizeJson(row.device_condition),
    reportedDefect: row.reported_defect || "",
    requestedServices: normalizeJson(row.requested_services),
    analysisPrice: row.analysis_price ?? "",
    servicePrice: row.service_price ?? "",
    estimatedDeadline: row.estimated_deadline || "",
    customerNotes: row.customer_notes || "",
    internalNotes: row.internal_notes || "",
    authorizations: normalizeJson(row.authorizations),
    warrantyDays: row.warranty_days ?? 90,
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    deletedAt: row.deleted_at || "",
  };
}

function toSupabase(payload = {}) {
  return {
    status: payload.status || "Recebido",
    entry_date: payload.entryDate || null,
    entry_time: payload.entryTime || null,
    customer_name: payload.customerName || "",
    customer_document: payload.customerDocument || "",
    customer_phone: payload.customerPhone || "",
    device_brand: payload.deviceBrand || "",
    device_model: payload.deviceModel || "",
    device_color: payload.deviceColor || "",
    device_serial_imei: payload.deviceSerialImei || "",
    device_password: payload.devicePassword || "",
    unlock_pattern: payload.unlockPattern || "",
    accessories: normalizeJson(payload.accessories),
    device_condition: normalizeJson(payload.deviceCondition),
    reported_defect: payload.reportedDefect || "",
    requested_services: normalizeJson(payload.requestedServices),
    analysis_price: payload.analysisPrice === "" ? null : payload.analysisPrice ?? null,
    service_price: payload.servicePrice === "" ? null : payload.servicePrice ?? null,
    estimated_deadline: payload.estimatedDeadline || "",
    customer_notes: payload.customerNotes || "",
    internal_notes: payload.internalNotes || "",
    authorizations: normalizeJson(payload.authorizations),
    warranty_days: Number(payload.warrantyDays || 90),
  };
}

export async function listServiceOrders() {
  assertSupabaseReady();
  const rows = await supabaseRequest("/service_orders?select=*&deleted_at=is.null&order=created_at.desc");
  return rows.map(fromSupabase);
}

export async function getServiceOrderById(id) {
  assertSupabaseReady();
  const rows = await supabaseRequest(`/service_orders?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ? fromSupabase(rows[0]) : null;
}

export async function createServiceOrder(payload) {
  assertSupabaseReady();
  const [row] = await supabaseRequest("/service_orders", {
    method: "POST",
    body: JSON.stringify(toSupabase(payload)),
  });
  return fromSupabase(row);
}

export async function updateServiceOrder(id, payload) {
  assertSupabaseReady();
  const [row] = await supabaseRequest(`/service_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(toSupabase(payload)),
  });
  return fromSupabase(row);
}

export async function searchServiceOrders(search) {
  assertSupabaseReady();
  const term = String(search || "").trim();
  if (!term) return listServiceOrders();

  const safeTerm = term.replace(/[%*_]/g, "");
  const query = [
    `customer_name.ilike.*${safeTerm}*`,
    `customer_phone.ilike.*${safeTerm}*`,
    `device_model.ilike.*${safeTerm}*`,
    `device_serial_imei.ilike.*${safeTerm}*`,
  ].join(",");
  const numberFilter = /^\d+$/.test(safeTerm) ? `,os_number.eq.${safeTerm}` : "";

  const rows = await supabaseRequest(`/service_orders?select=*&deleted_at=is.null&or=(${query}${numberFilter})&order=created_at.desc`);
  return rows.map(fromSupabase);
}

export async function archiveServiceOrder(id) {
  assertSupabaseReady();
  const [row] = await supabaseRequest(`/service_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  return fromSupabase(row);
}

export async function getNextServiceOrderNumber() {
  assertSupabaseReady();
  return supabaseRequest("/rpc/get_next_service_order_number_preview", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
