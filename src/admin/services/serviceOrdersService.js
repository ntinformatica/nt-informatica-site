import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";

export const serviceOrderStatuses = [
  "Recebido",
  "Em análise",
  "Aguardando autorização",
  "Aguardando peça",
  "Em reparo",
  "Pronto",
  "Entregue",
  "Cancelado",
];

export const serviceOrderStatusTones = {
  Recebido: "blue",
  "Em análise": "cyan",
  "Aguardando autorização": "amber",
  "Aguardando peça": "orange",
  "Em reparo": "purple",
  Pronto: "green",
  Entregue: "slate",
  Cancelado: "red",
};

export const defaultAccessories = {
  charger: false,
  power_supply: false,
  power_cable: false,
  usb_cable: false,
  case: false,
  screen_protector: false,
  sim_card: false,
  memory_card: false,
  removable_battery: false,
  controller: false,
  other: false,
  other_description: "",
};

export const defaultDeviceCondition = {
  powers_on: false,
  does_not_power_on: false,
  turns_on_and_off: false,
  no_image: false,
  broken_screen: false,
  touch_not_working: false,
  scratched_cover: false,
  broken_housing: false,
  damaged_buttons: false,
  oxidation_signs: false,
  wet_device: false,
  broken_seals: false,
  previously_opened: false,
  missing_parts: false,
  other: false,
  other_description: "",
};

export const defaultRequestedServices = {
  diagnostic: false,
  repair: false,
  screen_replacement: false,
  battery_replacement: false,
  connector_replacement: false,
  formatting: false,
  preventive_cleaning: false,
  data_recovery: false,
  upgrade: false,
  board_repair: false,
  quote: false,
  other: false,
  other_description: "",
};

export const defaultAuthorizations = {
  diagnostic: false,
  device_opening: false,
  testing: false,
  formatting_if_needed: false,
  whatsapp_contact: true,
  data_loss_risk: false,
  budget_may_change: false,
};

const sortableColumns = {
  recent: "created_at.desc",
  oldest: "created_at.asc",
  numberDesc: "os_number.desc",
  numberAsc: "os_number.asc",
  customerAsc: "customer_name.asc",
};

function assertSupabaseReady() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase não configurado. O módulo de Ordem de Serviço exige banco real.");
  }
}

function normalizeJson(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...fallback };
  return { ...fallback, ...value };
}

function trimOrNull(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function trimOrEmpty(value) {
  return String(value ?? "").trim();
}

export function parseServiceOrderMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim().replace(/[R$\s]/g, "");
  if (!raw) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot !== -1) {
    const [integerPart, decimalPart = ""] = raw.split(".");
    normalized = decimalPart.length === 3 && integerPart.length <= 3 ? raw.replace(/\./g, "") : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatServiceOrderMoney(value) {
  const parsed = parseServiceOrderMoney(value);
  if (parsed === null) return "";
  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moneyForInput(value) {
  return formatServiceOrderMoney(value);
}

function clampWarrantyDays(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 90;
  return Math.min(3650, Math.max(0, parsed));
}

function fromSupabase(row = {}) {
  return {
    id: row.id || "",
    osNumber: row.os_number || null,
    status: serviceOrderStatuses.includes(row.status) ? row.status : "Recebido",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    entryDate: row.entry_date || "",
    entryTime: row.entry_time ? String(row.entry_time).slice(0, 5) : "",
    customerName: row.customer_name || "",
    customerDocument: row.customer_document || "",
    customerPhone: row.customer_phone || "",
    deviceBrand: row.device_brand || "",
    deviceModel: row.device_model || "",
    deviceColor: row.device_color || "",
    deviceSerialImei: row.device_serial_imei || "",
    devicePassword: row.device_password || "",
    unlockPattern: row.unlock_pattern || "",
    accessories: normalizeJson(row.accessories, defaultAccessories),
    deviceCondition: normalizeJson(row.device_condition, defaultDeviceCondition),
    reportedDefect: row.reported_defect || "",
    requestedServices: normalizeJson(row.requested_services, defaultRequestedServices),
    analysisPrice: moneyForInput(row.analysis_price),
    servicePrice: moneyForInput(row.service_price),
    estimatedDeadline: row.estimated_deadline || "",
    customerNotes: row.customer_notes || "",
    internalNotes: row.internal_notes || "",
    authorizations: normalizeJson(row.authorizations, defaultAuthorizations),
    warrantyDays: row.warranty_days ?? 90,
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    deletedAt: row.deleted_at || "",
  };
}

function cleanStructuredValue(value, fallback) {
  const normalized = normalizeJson(value, fallback);
  return Object.fromEntries(Object.entries(normalized).map(([key, item]) => [
    key,
    typeof item === "string" ? item.trim() : Boolean(item),
  ]));
}

export function buildServiceOrderPayload(payload = {}) {
  const status = serviceOrderStatuses.includes(payload.status) ? payload.status : "Recebido";

  return {
    status,
    entry_date: trimOrNull(payload.entryDate),
    entry_time: trimOrNull(payload.entryTime),
    customer_name: trimOrEmpty(payload.customerName),
    customer_document: trimOrNull(payload.customerDocument),
    customer_phone: trimOrEmpty(payload.customerPhone),
    device_brand: trimOrEmpty(payload.deviceBrand),
    device_model: trimOrEmpty(payload.deviceModel),
    device_color: trimOrNull(payload.deviceColor),
    device_serial_imei: trimOrNull(payload.deviceSerialImei),
    device_password: trimOrNull(payload.devicePassword),
    unlock_pattern: trimOrNull(payload.unlockPattern),
    accessories: cleanStructuredValue(payload.accessories, defaultAccessories),
    device_condition: cleanStructuredValue(payload.deviceCondition, defaultDeviceCondition),
    reported_defect: trimOrEmpty(payload.reportedDefect),
    requested_services: cleanStructuredValue(payload.requestedServices, defaultRequestedServices),
    analysis_price: parseServiceOrderMoney(payload.analysisPrice),
    service_price: parseServiceOrderMoney(payload.servicePrice),
    estimated_deadline: trimOrNull(payload.estimatedDeadline),
    customer_notes: trimOrNull(payload.customerNotes),
    internal_notes: trimOrNull(payload.internalNotes),
    authorizations: cleanStructuredValue(payload.authorizations, defaultAuthorizations),
    warranty_days: clampWarrantyDays(payload.warrantyDays),
  };
}

function sanitizeSearchTerm(value) {
  return String(value || "")
    .trim()
    .replace(/^OS\s*/i, "")
    .replace(/[%*(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function serviceOrderQuery(options = {}) {
  const params = new URLSearchParams();
  const pageSize = Math.max(1, Math.min(100, Number(options.pageSize || 20)));
  const page = Math.max(1, Number(options.page || 1));
  const offset = (page - 1) * pageSize;
  const sort = sortableColumns[options.sort] || sortableColumns.recent;
  const filters = ["deleted_at.is.null"];
  const search = sanitizeSearchTerm(options.search);

  params.set("select", "*");
  params.set("limit", String(pageSize));
  params.set("offset", String(offset));
  params.set("order", sort);

  if (options.status && options.status !== "Todos os status") {
    filters.push(`status.eq.${options.status}`);
  }

  if (options.dateFrom) filters.push(`entry_date.gte.${options.dateFrom}`);
  if (options.dateTo) filters.push(`entry_date.lte.${options.dateTo}`);

  if (search) {
    const orFilters = [
      `customer_name.ilike.*${search}*`,
      `customer_phone.ilike.*${search}*`,
      `customer_document.ilike.*${search}*`,
      `device_brand.ilike.*${search}*`,
      `device_model.ilike.*${search}*`,
      `device_serial_imei.ilike.*${search}*`,
    ];
    const digits = search.replace(/\D/g, "");
    if (digits) {
      orFilters.push(`os_number.eq.${digits}`);
      orFilters.push(`customer_phone.ilike.*${digits}*`);
      orFilters.push(`customer_document.ilike.*${digits}*`);
    }
    params.set("or", `(${orFilters.join(",")})`);
  }

  filters.forEach((filter) => {
    const [column, operator, ...rest] = filter.split(".");
    params.append(column, `${operator}.${rest.join(".")}`);
  });

  return { query: params.toString(), page, pageSize };
}

export async function listServiceOrders(options = {}) {
  assertSupabaseReady();
  const { query, page, pageSize } = serviceOrderQuery(options);
  const response = await supabaseRequest(`/service_orders?${query}`, {
    headers: { Prefer: "count=exact" },
    returnMeta: true,
  });

  return {
    items: response.data.map(fromSupabase),
    total: response.total ?? response.data.length,
    page,
    pageSize,
  };
}

export async function countServiceOrders(options = {}) {
  assertSupabaseReady();
  const { query } = serviceOrderQuery({ ...options, page: 1, pageSize: 1 });
  const response = await supabaseRequest(`/service_orders?${query}`, {
    headers: { Prefer: "count=exact" },
    returnMeta: true,
  });
  return response.total ?? response.data.length;
}

export async function getServiceOrderSummary(options = {}) {
  const cleanOptions = {
    search: options.search || "",
    dateFrom: options.dateFrom || "",
    dateTo: options.dateTo || "",
    sort: "recent",
  };
  const entries = await Promise.all([
    countServiceOrders(cleanOptions),
    ...serviceOrderStatuses.map(async (status) => [status, await countServiceOrders({ ...cleanOptions, status })]),
  ]);
  const [total, ...statusEntries] = entries;
  return {
    total,
    statuses: Object.fromEntries(statusEntries),
  };
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
    body: JSON.stringify(buildServiceOrderPayload(payload)),
  });
  return fromSupabase(row);
}

export async function updateServiceOrder(id, payload) {
  assertSupabaseReady();
  const [row] = await supabaseRequest(`/service_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(buildServiceOrderPayload(payload)),
  });
  return fromSupabase(row);
}

export async function updateServiceOrderStatus(id, status) {
  assertSupabaseReady();
  if (!serviceOrderStatuses.includes(status)) {
    throw new Error("Status inválido para Ordem de Serviço.");
  }

  const [row] = await supabaseRequest(`/service_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return fromSupabase(row);
}

export async function searchServiceOrders(search, options = {}) {
  return listServiceOrders({ ...options, search });
}

export async function archiveServiceOrder(id) {
  assertSupabaseReady();
  const [row] = await supabaseRequest(`/service_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  return fromSupabase(row);
}

export async function getNextServiceOrderNumberPreview() {
  assertSupabaseReady();
  return supabaseRequest("/rpc/get_next_service_order_number_preview", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export const getNextServiceOrderNumber = getNextServiceOrderNumberPreview;
