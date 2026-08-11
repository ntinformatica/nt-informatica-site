import {
  BlingHttpError,
} from "../_shared/bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
  type BlingAccessContext,
} from "../_shared/blingConnection.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type SupabaseAuthUser = {
  id?: string;
  email?: string;
};

type StoreOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_document: string;
  financial_status: string;
  operational_status: string;
  created_at?: string | null;
  paid_at?: string | null;
  subtotal_amount: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  payment_method: string;
  installments?: number | null;
  bling_order_id?: string | null;
  bling_order_number?: string | null;
  bling_synced_at?: string | null;
  bling_sync_status?: string | null;
  bling_sync_metadata?: JsonObject | null;
  store_order_items?: StoreOrderItem[];
  order_billing_snapshots?: BillingSnapshot[] | BillingSnapshot;
};

type StoreOrderItem = {
  id: string;
  item_type: string;
  sku: string;
  internal_code: string;
  product_name: string;
  variation_name: string;
  quantity: number | string;
  final_unit_price: number | string;
  subtotal_amount: number | string;
};

type BillingSnapshot = {
  customer_name?: string;
  customer_document?: string;
  customer_email?: string;
  customer_phone?: string;
  postal_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
};

type BlingProduct = {
  id?: number | string | null;
  codigo?: string | null;
  nome?: string | null;
};

type BlingContact = {
  id?: number | string | null;
  nome?: string | null;
  numeroDocumento?: string | null;
};

type BlingContactResolution = {
  id: number;
  action: "existing_contact" | "updated_contact" | "created_contact";
};

type BlingCreateOrderStage =
  | "idle"
  | "find_existing_order"
  | "find_contact"
  | "create_contact"
  | "get_contact"
  | "update_contact"
  | "verify_contact_after_update"
  | "get_remote_order"
  | "update_existing_order"
  | "find_product"
  | "create_order";

type StageTracker = (stage: BlingCreateOrderStage) => void;

const SYNC_LOCK_STALE_MS = 10 * 60 * 1000;
const STORE_ORDER_SELECT = [
  "*",
  "store_order_items(*)",
  "order_billing_snapshots(*)",
].join(",");

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
}

function supabaseUrl() {
  return env("SUPABASE_URL").replace(/\/+$/, "");
}

function serviceRoleKey() {
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function money(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value));
}

function dateOnly(value: unknown) {
  const parsed = value ? new Date(String(value)) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toISOString().slice(0, 10);
}

function maskDocument(value: unknown) {
  const digits = cleanDigits(value);
  if (!digits) return "";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function isStaleSyncMetadata(metadata: unknown) {
  if (!isObject(metadata)) return false;
  const startedAt = cleanText(metadata.syncStartedAt);
  if (!startedAt) return false;
  const timestamp = new Date(startedAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now() - SYNC_LOCK_STALE_MS;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getUserFromJwt(token: string) {
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey(),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = await parseResponse(response);

  if (!response.ok) return null;
  return payload as SupabaseAuthUser;
}

async function isAdminUser(userId: string) {
  const adminUser = await getSingle(
    `/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
  );
  return Boolean(adminUser);
}

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text) return {};
  const payload = JSON.parse(text);
  return isObject(payload) ? payload : {};
}

async function loadOrder(orderId: string) {
  const order = await getSingle(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}&select=${encodeURIComponent(STORE_ORDER_SELECT)}&limit=1`,
  ) as StoreOrder | null;
  if (!order?.id) return order;

  const billingSnapshot = await loadBillingSnapshot(order.id);
  const snapshots = billingSnapshot
    ? [billingSnapshot]
    : normalizeBillingSnapshots(order.order_billing_snapshots);

  console.info("bling-create-order billing snapshot diagnostic", stringifyLog({
    orderId: order.id,
    billingSnapshotFound: snapshots.length > 0,
    hasStreet: Boolean(cleanText(snapshots[0]?.street)),
    hasNumber: Boolean(cleanText(snapshots[0]?.number)),
    hasDistrict: Boolean(cleanText(snapshots[0]?.district)),
    hasPostalCode: cleanDigits(snapshots[0]?.postal_code).length === 8,
    hasCity: Boolean(cleanText(snapshots[0]?.city)),
    hasState: /^[A-Z]{2}$/.test(cleanText(snapshots[0]?.state).toUpperCase()),
  }));

  return {
    ...order,
    order_billing_snapshots: snapshots,
  };
}

function normalizeBillingSnapshots(value: StoreOrder["order_billing_snapshots"]) {
  if (Array.isArray(value)) return value.filter(isObject) as BillingSnapshot[];
  if (isObject(value)) return [value as BillingSnapshot];
  return [];
}

function firstBillingSnapshot(order: StoreOrder) {
  return normalizeBillingSnapshots(order.order_billing_snapshots)[0] || null;
}

async function loadBillingSnapshot(orderId: string) {
  return await getSingle(
    `/order_billing_snapshots?order_id=eq.${encodeURIComponent(orderId)}&select=customer_name,customer_document,customer_email,customer_phone,postal_code,street,number,complement,district,city,state,country&limit=1`,
  ) as BillingSnapshot | null;
}

async function markSyncing(orderId: string, syncAttemptId: string) {
  const startedAt = nowIso();
  const rows = await supabaseRest(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}`
    + "&bling_order_id=is.null"
    + "&bling_sync_status=in.(not_sent,error)"
    + "&select=id,bling_sync_status,bling_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "syncing",
        bling_sync_error: "",
        bling_sync_metadata: {
          syncAttemptId,
          syncStartedAt: startedAt,
        },
      }),
    },
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function markPreflightError(orderId: string, errorCode: string, message: string) {
  await supabaseRest(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}`
    + "&bling_order_id=is.null"
    + "&bling_sync_status=in.(not_sent,error)"
    + "&select=id",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "error",
        bling_sync_error: message,
        bling_sync_metadata: {
          errorCode,
          failedAt: nowIso(),
        },
      }),
    },
  ).catch(() => null);
}

async function markSyncError(orderId: string, syncAttemptId: string, errorCode: string, message: string) {
  const rows = await supabaseRest(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}`
    + "&bling_order_id=is.null"
    + "&bling_sync_status=eq.syncing"
    + `&bling_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(syncAttemptId)}`
    + "&select=id",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "error",
        bling_sync_error: message,
        bling_sync_metadata: {
          syncAttemptId,
          errorCode,
          failedAt: nowIso(),
        },
      }),
    },
  ).catch(() => []);

  return Array.isArray(rows) && rows.length > 0;
}

async function saveBlingLink(orderId: string, response: unknown, syncAttemptId: string) {
  const data = isObject(response) && isObject(response.data) ? response.data : response;
  const blingOrderId = isObject(data) ? cleanText(data.id) : "";
  const blingOrderNumber = isObject(data) ? cleanText(data.numero || data.numeroLoja || "") : "";
  if (!blingOrderId) throw new Error("bling_response_without_order_id");

  const syncedAt = nowIso();
  const rows = await supabaseRest(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}`
    + "&bling_order_id=is.null"
    + "&bling_sync_status=eq.syncing"
    + `&bling_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(syncAttemptId)}`
    + "&select=id,bling_order_id,bling_order_number,bling_synced_at,bling_sync_status,bling_sync_error,bling_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_order_id: blingOrderId,
        bling_order_number: blingOrderNumber,
        bling_synced_at: syncedAt,
        bling_sync_status: "synced",
        bling_sync_error: "",
        bling_sync_metadata: {
          syncedAt,
          syncAttemptId,
          response: sanitizeBlingResponse(response),
        },
      }),
    },
  );

  const updatedOrder = Array.isArray(rows) ? rows[0] || null : null;
  if (!updatedOrder) throw new Error("bling_sync_lock_lost");
  return updatedOrder;
}

async function recoverStaleSyncing(orderId: string, syncAttemptId: string) {
  const current = await loadOrder(orderId);
  if (!current || current.bling_order_id || current.bling_sync_status !== "syncing") return false;
  if (!isStaleSyncMetadata(current.bling_sync_metadata)) return false;

  const previousMetadata = isObject(current.bling_sync_metadata) ? current.bling_sync_metadata : {};
  const previousAttemptId = cleanText(previousMetadata.syncAttemptId);
  const previousStartedAt = cleanText(previousMetadata.syncStartedAt);
  const startedAt = nowIso();
  let filters = `/store_orders?id=eq.${encodeURIComponent(orderId)}`
    + "&bling_order_id=is.null"
    + "&bling_sync_status=eq.syncing";
  filters += previousAttemptId
    ? `&bling_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(previousAttemptId)}`
    : "&bling_sync_metadata->>syncAttemptId=is.null";
  filters += `&bling_sync_metadata->>syncStartedAt=eq.${encodeURIComponent(previousStartedAt)}`;

  const rows = await supabaseRest(
    filters
    + "&select=id,bling_sync_status,bling_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "syncing",
        bling_sync_error: "",
        bling_sync_metadata: {
          syncAttemptId,
          syncStartedAt: startedAt,
          recoveredStaleLockAt: startedAt,
          previousSyncMetadata: previousMetadata,
        },
      }),
    },
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function insertOrderLog(orderId: string, userId: string, message: string, metadata: JsonObject = {}) {
  await supabaseRest("/store_order_logs", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      event_type: "bling_order_created",
      message,
      actor_type: "admin",
      actor_id: userId,
      source: "admin",
      metadata,
    }),
  }).catch((error) => {
    console.warn("bling-create-order log skipped", {
      message: error instanceof Error ? error.message : "Falha ao registrar log.",
    });
  });
}

function validateOrder(order: StoreOrder) {
  if (!order.id) throw new Error("invalid_order");
  if (order.bling_order_id) throw new Error("already_linked");

  const items = Array.isArray(order.store_order_items) ? order.store_order_items : [];
  if (!items.length) throw new Error("missing_order_items");

  const total = money(order.total_amount);
  if (total === null || total <= 0) throw new Error("invalid_order_total");

  const billing = firstBillingSnapshot(order);
  const customerName = cleanText(billing?.customer_name || order.customer_name);
  const customerDocument = cleanDigits(billing?.customer_document || order.customer_document);
  if (!customerName) throw new Error("missing_customer_data");
  if (![11, 14].includes(customerDocument.length)) throw new Error("missing_customer_document");

  for (const item of items) {
    const quantity = Number(item.quantity);
    const price = money(item.final_unit_price);
    const code = cleanText(item.sku || item.internal_code);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("invalid_item_quantity");
    if (price === null) throw new Error("invalid_item_price");
    if (!code) throw new Error("missing_product_sku");
  }
}

function validationMessage(code: string) {
  const messages: Record<string, string> = {
    invalid_order: "Pedido invalido para envio ao Bling.",
    missing_order_items: "Pedido sem itens para enviar ao Bling.",
    invalid_order_total: "Pedido sem valor total valido.",
    missing_customer_data: "Pedido sem nome do cliente.",
    missing_customer_document: "Pedido sem CPF/CNPJ valido para enviar ao Bling.",
    missing_bling_contact_name: "Pedido sem nome do cliente para criar contato no Bling.",
    missing_bling_contact_document: "Pedido sem CPF/CNPJ valido para criar contato no Bling.",
    missing_billing_street: "Endereco de faturamento incompleto: endereco ausente.",
    missing_billing_number: "Endereco de faturamento incompleto: numero ausente.",
    missing_billing_district: "Endereco de faturamento incompleto: bairro ausente.",
    missing_billing_postal_code: "Endereco de faturamento incompleto: CEP ausente ou invalido.",
    missing_billing_city: "Endereco de faturamento incompleto: cidade ausente.",
    missing_billing_state: "Endereco de faturamento incompleto: UF ausente ou invalida.",
    multiple_bling_contacts: "Mais de um contato no Bling possui o mesmo CPF/CNPJ. Revise manualmente antes de enviar o pedido.",
    bling_contact_without_id: "O Bling retornou um contato sem ID.",
    bling_contact_response_without_id: "O Bling criou uma resposta sem ID de contato.",
    invalid_item_quantity: "Pedido possui item com quantidade invalida.",
    invalid_item_price: "Pedido possui item com valor invalido.",
    missing_product_sku: "Pedido possui item sem SKU/codigo para localizar no Bling.",
    missing_bling_product: "Produto do pedido nao foi encontrado no Bling pelo SKU.",
    bling_response_without_order_id: "O Bling criou uma resposta sem ID de pedido.",
  };
  return messages[code] || "Pedido nao esta completo para envio ao Bling.";
}

function isBlingContactError(code: string) {
  return code === "missing_bling_contact_name"
    || code === "missing_bling_contact_document"
    || code === "missing_billing_street"
    || code === "missing_billing_number"
    || code === "missing_billing_district"
    || code === "missing_billing_postal_code"
    || code === "missing_billing_city"
    || code === "missing_billing_state"
    || code === "multiple_bling_contacts"
    || code === "bling_contact_without_id"
    || code === "bling_contact_response_without_id";
}

function paymentDescription(order: StoreOrder) {
  if (order.payment_method === "card") return "Cartao";
  if (order.payment_method === "pix") return "Pix";
  return "Pagamento NT";
}

function buildContact(order: StoreOrder) {
  const billing = firstBillingSnapshot(order) || {};
  const document = cleanDigits(billing.customer_document || order.customer_document);
  return {
    nome: cleanText(billing.customer_name || order.customer_name),
    tipoPessoa: document.length === 14 ? "J" : "F",
    numeroDocumento: document,
    email: cleanText(billing.customer_email || order.customer_email),
    telefone: cleanDigits(billing.customer_phone || order.customer_phone),
    endereco: {
      endereco: cleanText(billing.street),
      numero: cleanText(billing.number),
      complemento: cleanText(billing.complement),
      bairro: cleanText(billing.district),
      cep: cleanDigits(billing.postal_code),
      municipio: cleanText(billing.city),
      uf: cleanText(billing.state).toUpperCase(),
      pais: cleanText(billing.country || "Brasil"),
    },
  };
}

function compactObject(value: JsonObject): JsonObject {
  const compacted: JsonObject = {};
  for (const [key, raw] of Object.entries(value)) {
    if (Array.isArray(raw)) {
      const items = raw
        .map((item) => isObject(item) ? compactObject(item) : item)
        .filter((item) => item !== "" && item !== null && item !== undefined);
      if (items.length) compacted[key] = items;
      continue;
    }
    if (isObject(raw)) {
      const nested = compactObject(raw);
      if (Object.keys(nested).length) compacted[key] = nested;
      continue;
    }
    if (raw !== "" && raw !== null && raw !== undefined) compacted[key] = raw;
  }
  return compacted;
}

function blingContactId(value: unknown) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function contactDocument(contact: unknown) {
  if (!isObject(contact)) return "";
  return cleanDigits(contact.numeroDocumento || contact.documento || contact.cpf || contact.cnpj);
}

function buildBlingContactPayload(order: StoreOrder) {
  const contact = buildContact(order);
  if (!contact.nome) throw new Error("missing_bling_contact_name");
  if (![11, 14].includes(contact.numeroDocumento.length)) throw new Error("missing_bling_contact_document");
  validateFiscalAddress(contact.endereco);

  const enderecoGeral = compactObject({
    endereco: contact.endereco.endereco,
    cep: contact.endereco.cep,
    bairro: contact.endereco.bairro,
    municipio: contact.endereco.municipio,
    uf: contact.endereco.uf,
    numero: contact.endereco.numero,
    complemento: contact.endereco.complemento,
  });

  return compactObject({
    nome: contact.nome,
    situacao: "A",
    numeroDocumento: contact.numeroDocumento,
    telefone: contact.telefone,
    tipo: contact.tipoPessoa,
    email: contact.email,
    endereco: Object.keys(enderecoGeral).length ? { geral: enderecoGeral } : undefined,
  });
}

function billingAddressPresence(order: StoreOrder) {
  const billing = firstBillingSnapshot(order) || {};
  return {
    street: Boolean(cleanText(billing.street)),
    number: Boolean(cleanText(billing.number)),
    district: Boolean(cleanText(billing.district)),
    postalCode: cleanDigits(billing.postal_code).length === 8,
    city: Boolean(cleanText(billing.city)),
    state: /^[A-Z]{2}$/.test(cleanText(billing.state).toUpperCase()),
    complement: Boolean(cleanText(billing.complement)),
  };
}

function payloadAddressPresence(payload: unknown) {
  const address = isObject(payload) && isObject(payload.endereco) ? payload.endereco : {};
  const general = isObject(address.geral) ? address.geral : {};
  return {
    endereco: Boolean(cleanText(general.endereco)),
    numero: Boolean(cleanText(general.numero)),
    bairro: Boolean(cleanText(general.bairro)),
    cep: cleanDigits(general.cep).length === 8,
    municipio: Boolean(cleanText(general.municipio)),
    uf: /^[A-Z]{2}$/.test(cleanText(general.uf).toUpperCase()),
    complemento: Boolean(cleanText(general.complemento)),
  };
}

function blingContactAddressPresence(contact: unknown) {
  const address = isObject(contact) && isObject(contact.endereco) ? contact.endereco : {};
  const general = isObject(address.geral) ? address.geral : {};
  return {
    endereco: Boolean(cleanText(general.endereco)),
    numero: Boolean(cleanText(general.numero)),
    bairro: Boolean(cleanText(general.bairro)),
    cep: cleanDigits(general.cep).length === 8,
    municipio: Boolean(cleanText(general.municipio)),
    uf: /^[A-Z]{2}$/.test(cleanText(general.uf).toUpperCase()),
    complemento: Boolean(cleanText(general.complemento)),
  };
}

function responseShape(response: unknown) {
  const payload = isObject(response) ? response : {};
  const data = isObject(payload.data) ? payload.data : null;
  return {
    hasBody: response !== null && response !== undefined && !(typeof response === "string" && !response.trim()),
    topLevelKeys: Object.keys(payload),
    hasData: Boolean(data),
    dataKeys: data ? Object.keys(data) : [],
  };
}

async function findBlingContactByDocument(context: BlingAccessContext, document: string, setStage?: StageTracker) {
  const query = new URLSearchParams();
  query.set("pagina", "1");
  query.set("limite", "10");
  query.set("numeroDocumento", document);
  setStage?.("find_contact");
  const response = await blingRequestWithTokenRefresh(context, `/contatos?${query.toString()}`, { method: "GET" });
  const rows = isObject(response) && Array.isArray(response.data) ? response.data : [];
  const matches = rows.filter((item) => contactDocument(item) === document);

  if (matches.length > 1) throw new Error("multiple_bling_contacts");
  if (matches.length === 1) {
    const contact = matches[0] as BlingContact;
    const id = blingContactId(contact.id);
    if (!id) throw new Error("bling_contact_without_id");
    return id;
  }
  return null;
}

async function loadBlingContactById(
  context: BlingAccessContext,
  contactId: number,
  setStage?: StageTracker,
  stage: BlingCreateOrderStage = "get_contact",
) {
  setStage?.(stage);
  const response = await blingRequestWithTokenRefresh(context, `/contatos/${encodeURIComponent(String(contactId))}`, { method: "GET" });
  const data = isObject(response) && isObject(response.data) ? response.data : response;
  return isObject(data) ? data : {};
}

function validateFiscalAddress(address: ReturnType<typeof buildContact>["endereco"]) {
  if (!address.endereco) throw new Error("missing_billing_street");
  if (!address.numero) throw new Error("missing_billing_number");
  if (!address.bairro) throw new Error("missing_billing_district");
  if (address.cep.length !== 8) throw new Error("missing_billing_postal_code");
  if (!address.municipio) throw new Error("missing_billing_city");
  if (!/^[A-Z]{2}$/.test(address.uf)) throw new Error("missing_billing_state");
}

function mergeBlingContactPayload(remoteContact: JsonObject, managedContact: JsonObject) {
  const remoteAddress = isObject(remoteContact.endereco) ? remoteContact.endereco : {};
  const remoteGeneralAddress = isObject(remoteAddress.geral) ? remoteAddress.geral : {};
  const managedAddress = isObject(managedContact.endereco) ? managedContact.endereco : {};
  const managedGeneralAddress = isObject(managedAddress.geral) ? managedAddress.geral : {};

  return compactObject({
    ...remoteContact,
    ...managedContact,
    endereco: {
      ...remoteAddress,
      ...managedAddress,
      geral: {
        ...remoteGeneralAddress,
        ...managedGeneralAddress,
      },
    },
  });
}

async function updateBlingContact(context: BlingAccessContext, contactId: number, order: StoreOrder, setStage?: StageTracker) {
  const remoteContact = await loadBlingContactById(context, contactId, setStage);
  const payload = mergeBlingContactPayload(remoteContact, buildBlingContactPayload(order));
  console.info("bling-create-order contact update diagnostic", stringifyLog({
    orderId: order.id,
    stage: "update_contact",
    blingContactId: contactId,
    billingAddressPresence: billingAddressPresence(order),
    payloadAddressPresence: payloadAddressPresence(payload),
  }));

  setStage?.("update_contact");
  const updateResponse = await blingRequestWithTokenRefresh(context, `/contatos/${encodeURIComponent(String(contactId))}`, {
    method: "PUT",
    body: payload,
  });
  console.info("bling-create-order contact update response", stringifyLog({
    orderId: order.id,
    stage: "update_contact",
    blingContactId: contactId,
    httpStatus: "success_2xx",
    exactHttpStatusAvailable: false,
    responseShape: responseShape(updateResponse),
  }));

  const verifiedContact = await loadBlingContactById(context, contactId, setStage, "verify_contact_after_update");
  console.info("bling-create-order contact verify after update", stringifyLog({
    orderId: order.id,
    stage: "verify_contact_after_update",
    blingContactId: contactId,
    addressPresence: blingContactAddressPresence(verifiedContact),
  }));
}

async function createBlingContact(context: BlingAccessContext, order: StoreOrder, setStage?: StageTracker) {
  const payload = buildBlingContactPayload(order);
  setStage?.("create_contact");
  const response = await blingRequestWithTokenRefresh(context, "/contatos", {
    method: "POST",
    body: payload,
  });
  const data = isObject(response) && isObject(response.data) ? response.data : response;
  const id = isObject(data) ? blingContactId(data.id) : null;
  if (!id) throw new Error("bling_contact_response_without_id");
  return id;
}

async function ensureBlingContactForOrder(
  context: BlingAccessContext,
  order: StoreOrder,
  setStage?: StageTracker,
): Promise<BlingContactResolution> {
  const contact = buildContact(order);
  if (![11, 14].includes(contact.numeroDocumento.length)) throw new Error("missing_bling_contact_document");

  const existingId = await findBlingContactByDocument(context, contact.numeroDocumento, setStage);
  if (existingId) {
    await updateBlingContact(context, existingId, order, setStage);
    return { id: existingId, action: "updated_contact" };
  }

  const createdId = await createBlingContact(context, order, setStage);
  return { id: createdId, action: "created_contact" };
}

async function findBlingProductByCode(context: BlingAccessContext, code: string, setStage?: StageTracker) {
  const query = new URLSearchParams();
  query.set("pagina", "1");
  query.set("limite", "10");
  query.set("codigo", code);
  setStage?.("find_product");
  const response = await blingRequestWithTokenRefresh(context, `/produtos?${query.toString()}`, { method: "GET" });
  const rows = isObject(response) && Array.isArray(response.data) ? response.data : [];
  return rows.find((item) => {
    const product = isObject(item) ? item as BlingProduct : {};
    return cleanText(product.codigo).toLowerCase() === code.toLowerCase();
  }) as BlingProduct | undefined;
}

async function buildItems(context: BlingAccessContext, order: StoreOrder, setStage?: StageTracker) {
  const items = [];
  for (const item of order.store_order_items || []) {
    const code = cleanText(item.sku || item.internal_code);
    const blingProduct = await findBlingProductByCode(context, code, setStage);
    if (!blingProduct?.id) throw new Error("missing_bling_product");

    items.push({
      quantidade: Number(item.quantity),
      valor: money(item.final_unit_price),
      descricao: cleanText(item.product_name),
      codigo: code,
      unidade: "UN",
      desconto: 0,
      produto: {
        id: Number(blingProduct.id),
      },
    });
  }
  return items;
}

async function findExistingBlingOrderByNumeroLoja(context: BlingAccessContext, orderNumber: string, setStage?: StageTracker) {
  const query = new URLSearchParams();
  query.set("pagina", "1");
  query.set("limite", "10");
  query.set("numerosLojas[]", orderNumber);
  setStage?.("find_existing_order");
  const response = await blingRequestWithTokenRefresh(context, `/pedidos/vendas?${query.toString()}`, { method: "GET" });
  const rows = isObject(response) && Array.isArray(response.data) ? response.data : [];
  return rows.find((item) => {
    const order = isObject(item) ? item : {};
    return cleanText(order.numeroLoja).toLowerCase() === orderNumber.toLowerCase()
      || cleanText(order.numeroPedidoLoja).toLowerCase() === orderNumber.toLowerCase();
  });
}

function buildShippingLabel(order: StoreOrder) {
  const contact = buildContact(order);
  return {
    nome: contact.nome,
    endereco: contact.endereco.endereco,
    numero: contact.endereco.numero,
    complemento: contact.endereco.complemento,
    municipio: contact.endereco.municipio,
    uf: contact.endereco.uf,
    cep: contact.endereco.cep,
    bairro: contact.endereco.bairro,
    nomePais: contact.endereco.pais,
  };
}

function buildBlingOrderPayload(order: StoreOrder, items: JsonObject[], contactId: number) {
  const total = money(order.total_amount) || 0;
  return {
    contato: {
      id: contactId,
    },
    itens: items,
    numeroLoja: order.order_number,
    data: dateOnly(order.created_at),
    totalProdutos: money(order.subtotal_amount) || total,
    total,
    desconto: {
      valor: money(order.discount_amount) || 0,
      unidade: "REAL",
    },
    parcelas: [
      {
        dataVencimento: dateOnly(order.paid_at || order.created_at),
        valor: total,
        observacoes: paymentDescription(order),
      },
    ],
    observacoesInternas: `Pedido NT ${order.order_number}. Criado manualmente pelo NT Admin. Nao emitir NF-e automaticamente nesta etapa.`,
    transporte: {
      fretePorConta: 0,
      frete: 0,
      quantidadeVolumes: 1,
      etiqueta: buildShippingLabel(order),
    },
  };
}

async function loadRemoteBlingOrder(context: BlingAccessContext, blingOrderId: string, setStage?: StageTracker) {
  setStage?.("get_remote_order");
  const response = await blingRequestWithTokenRefresh(context, `/pedidos/vendas/${encodeURIComponent(blingOrderId)}`, { method: "GET" });
  const data = isObject(response) && isObject(response.data) ? response.data : response;
  if (!isObject(data)) throw new Error("bling_response_without_order_id");
  return data;
}

function buildExistingBlingOrderUpdatePayload(remoteOrder: JsonObject, order: StoreOrder, contactId: number) {
  const remoteTransport = isObject(remoteOrder.transporte) ? remoteOrder.transporte : {};
  const remoteLabel = isObject(remoteTransport.etiqueta) ? remoteTransport.etiqueta : {};
  const remoteContact = isObject(remoteOrder.contato) ? remoteOrder.contato : {};

  return compactObject({
    ...remoteOrder,
    contato: {
      ...remoteContact,
      id: contactId,
    },
    numeroLoja: cleanText(remoteOrder.numeroLoja) || order.order_number,
    transporte: {
      ...remoteTransport,
      etiqueta: {
        ...remoteLabel,
        ...buildShippingLabel(order),
      },
    },
  });
}

function updateOrderDiagnostics(remoteOrder: JsonObject, payload: JsonObject, contactId: number) {
  const remoteTransport = isObject(remoteOrder.transporte) ? remoteOrder.transporte : {};
  const payloadTransport = isObject(payload.transporte) ? payload.transporte : {};
  return {
    contactIdPreserved: blingContactId(isObject(payload.contato) ? payload.contato.id : null) === contactId,
    numeroLojaPreserved: cleanText(remoteOrder.numeroLoja) === cleanText(payload.numeroLoja),
    totalPreserved: Number(remoteOrder.total) === Number(payload.total),
    totalProdutosPreserved: Number(remoteOrder.totalProdutos) === Number(payload.totalProdutos),
    descontoPreserved: JSON.stringify(remoteOrder.desconto || null) === JSON.stringify(payload.desconto || null),
    itensCountPreserved: Array.isArray(remoteOrder.itens) && Array.isArray(payload.itens)
      ? remoteOrder.itens.length === payload.itens.length
      : true,
    parcelasCountPreserved: Array.isArray(remoteOrder.parcelas) && Array.isArray(payload.parcelas)
      ? remoteOrder.parcelas.length === payload.parcelas.length
      : true,
    addressPresence: payloadAddressPresence({ endereco: { geral: isObject(payloadTransport.etiqueta) ? payloadTransport.etiqueta : {} } }),
  };
}

async function updateExistingBlingOrder(
  context: BlingAccessContext,
  order: StoreOrder,
  contactId: number,
  setStage?: StageTracker,
) {
  const blingOrderId = cleanText(order.bling_order_id);
  if (!blingOrderId) throw new Error("bling_response_without_order_id");

  const remoteOrder = await loadRemoteBlingOrder(context, blingOrderId, setStage);
  const payload = buildExistingBlingOrderUpdatePayload(remoteOrder, order, contactId);
  console.info("bling-create-order existing order update diagnostic", stringifyLog({
    orderId: order.id,
    stage: "update_existing_order",
    blingOrderId,
    blingContactId: contactId,
    diagnostics: updateOrderDiagnostics(remoteOrder, payload, contactId),
  }));

  setStage?.("update_existing_order");
  const response = await blingRequestWithTokenRefresh(context, `/pedidos/vendas/${encodeURIComponent(blingOrderId)}`, {
    method: "PUT",
    body: payload,
  });

  console.info("bling-create-order existing order update response", stringifyLog({
    orderId: order.id,
    stage: "update_existing_order",
    blingOrderId,
    httpStatus: "success_2xx",
    exactHttpStatusAvailable: false,
    responseShape: responseShape(response),
  }));

  return response;
}

function sanitizeBlingResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeBlingResponse);
  if (typeof value === "string") return maskSensitiveText(value);
  if (!isObject(value)) return value;

  const sanitized: JsonObject = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (isSensitiveSecretKey(normalized)) continue;
    if (isSensitivePersonalKey(normalized)) {
      sanitized[key] = maskPersonalValue(raw);
      continue;
    }
    sanitized[key] = sanitizeBlingResponse(raw);
  }
  return sanitized;
}

function isSensitiveSecretKey(normalizedKey: string) {
  return normalizedKey.includes("token")
    || normalizedKey.includes("authorization")
    || normalizedKey.includes("apikey")
    || normalizedKey.includes("api_key")
    || normalizedKey.includes("secret")
    || normalizedKey.includes("senha")
    || normalizedKey.includes("password");
}

function isSensitivePersonalKey(normalizedKey: string) {
  return normalizedKey.includes("documento")
    || normalizedKey === "cpf"
    || normalizedKey === "cnpj"
    || normalizedKey.includes("cartao")
    || normalizedKey.includes("cartão")
    || normalizedKey.includes("card")
    || normalizedKey.includes("cvv")
    || normalizedKey.includes("validade")
    || normalizedKey.includes("email")
    || normalizedKey.includes("telefone")
    || normalizedKey.includes("celular")
    || normalizedKey.includes("phone")
    || normalizedKey.includes("endereco")
    || normalizedKey.includes("logradouro")
    || normalizedKey.includes("bairro")
    || normalizedKey.includes("cep")
    || normalizedKey.includes("complemento");
}

function maskPersonalValue(value: unknown) {
  if (Array.isArray(value)) return value.map(maskPersonalValue);
  if (isObject(value)) return sanitizeBlingResponse(value);
  if (typeof value === "number") return "***";
  const text = cleanText(value);
  if (!text) return "";
  if (text.includes("@")) return text.replace(/(^.).*(@.*$)/, "$1***$2");
  const digits = cleanDigits(text);
  if (digits.length >= 8) return maskDocument(digits);
  return "***";
}

function maskSensitiveText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (match) => String(maskPersonalValue(match)))
    .replace(/\b\d{11,19}\b/g, (match) => maskDocument(match));
}

function stringifySafe(value: unknown, maxLength = 500) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function stringifyLog(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return stringifySafe(value, 2000);
  }
}

function collectBlingMessages(value: unknown, messages: string[] = []) {
  if (messages.length >= 4) return messages;
  if (typeof value === "string") {
    const text = maskSensitiveText(value).trim();
    if (text) messages.push(text);
    return messages;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectBlingMessages(item, messages);
    return messages;
  }
  if (!isObject(value)) return messages;

  const preferredKeys = ["message", "mensagem", "description", "descricao", "detail", "details", "error", "errors", "field", "fields", "campo", "campos"];
  for (const key of preferredKeys) {
    if (key in value) collectBlingMessages(value[key], messages);
  }
  if (!messages.length) {
    for (const nested of Object.values(value)) collectBlingMessages(nested, messages);
  }
  return messages;
}

function summarizeBlingError(error: BlingHttpError) {
  const sanitizedPayload = sanitizeBlingResponse(error.payload);
  const messages = [...new Set(collectBlingMessages(sanitizedPayload).map((message) => message.trim()).filter(Boolean))];
  const apiMessage = messages.join(" | ");
  return {
    status: error.status,
    temporary: error.temporary,
    message: apiMessage || stringifySafe(sanitizedPayload, 300) || "sem detalhes retornados pela API",
    payload: sanitizedPayload,
  };
}

function blingErrorMessage(error: BlingHttpError, apiMessage = "") {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para criar pedido de venda no Bling.";
  if (error.status === 404) return "Recurso nao encontrado no Bling.";
  if (error.status === 400 || error.status === 422) {
    return apiMessage
      ? `Nao foi possivel criar o pedido no Bling: ${apiMessage}`
      : "O Bling recusou os dados do pedido. Revise os dados fiscais e SKUs.";
  }
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel criar o pedido no Bling.";
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  let orderId = "";
  let syncAttemptId = "";
  let ownsSyncAttempt = false;
  let currentStage: BlingCreateOrderStage = "idle";
  const setStage: StageTracker = (stage) => {
    currentStage = stage;
  };

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const token = bearerToken(request);
    if (!token) return fail(request, "Nao autenticado.", 401);

    const user = await getUserFromJwt(token);
    if (!user?.id) return fail(request, "Nao autenticado.", 401);

    const admin = await isAdminUser(user.id);
    if (!admin) return fail(request, "Acesso restrito a administradores.", 403);

    const body = await readJsonBody(request);
    orderId = cleanText(body.order_id);
    if (!isUuid(orderId)) return fail(request, "Pedido invalido.", 400, { code: "invalid_order_id" });

    const order = await loadOrder(orderId);
    if (!order) return fail(request, "Pedido nao encontrado.", 404, { code: "order_not_found" });

    if (order.bling_order_id) {
      const connection = await loadActiveBlingConnection();
      const accessToken = await accessTokenForBlingConnection(connection);
      const context = { connection, accessToken };
      const contact = await ensureBlingContactForOrder(context, order, setStage);
      console.info("bling-create-order contact resolved", {
        orderId,
        action: contact.action,
        blingContactId: contact.id,
        alreadyLinkedOrder: true,
      });
      await updateExistingBlingOrder(context, order, contact.id, setStage);

      return ok(request, {
        success: true,
        already_linked: true,
        bling_order_updated: true,
        bling_order_id: order.bling_order_id,
        bling_order_number: order.bling_order_number || "",
        order: {
          id: order.id,
          bling_order_id: order.bling_order_id,
          bling_order_number: order.bling_order_number || "",
          bling_synced_at: order.bling_synced_at || null,
          bling_sync_status: "synced",
          bling_sync_error: "",
        },
      });
    }

    try {
      validateOrder(order);
    } catch (validationError) {
      const code = validationError instanceof Error ? validationError.message : "invalid_order";
      await markPreflightError(orderId, code, validationMessage(code));
      return fail(request, validationMessage(code), 422, { code });
    }

    syncAttemptId = crypto.randomUUID();
    const connection = await loadActiveBlingConnection();
    const accessToken = await accessTokenForBlingConnection(connection);
    const context = { connection, accessToken };
    const existingBlingOrder = await findExistingBlingOrderByNumeroLoja(context, order.order_number, setStage);

    const lockAcquired = await markSyncing(orderId, syncAttemptId);
    ownsSyncAttempt = lockAcquired;
    if (!lockAcquired) {
      const current = await loadOrder(orderId);
      if (current?.bling_order_id) {
        return ok(request, {
          success: true,
          already_linked: true,
          bling_order_id: current.bling_order_id,
          bling_order_number: current.bling_order_number || "",
          order: {
            id: current.id,
            bling_order_id: current.bling_order_id,
            bling_order_number: current.bling_order_number || "",
            bling_synced_at: current.bling_synced_at || null,
            bling_sync_status: "synced",
            bling_sync_error: "",
          },
        });
      }
      if (current?.bling_sync_status === "syncing" && isStaleSyncMetadata(current.bling_sync_metadata)) {
        ownsSyncAttempt = await recoverStaleSyncing(orderId, syncAttemptId);
      }
      if (!ownsSyncAttempt) {
        return fail(request, "Pedido ja esta em envio ao Bling. Aguarde a conclusao.", 409, {
          code: "bling_sync_in_progress",
        });
      }
    }

    if (existingBlingOrder) {
      const updatedOrder = await saveBlingLink(orderId, { data: existingBlingOrder }, syncAttemptId);
      await insertOrderLog(orderId, user.id, "Pedido vinculado a pedido ja existente no Bling.", {
        bling_order_id: updatedOrder?.bling_order_id || null,
        bling_order_number: updatedOrder?.bling_order_number || null,
      });
      return ok(request, {
        success: true,
        already_linked: true,
        bling_order_id: updatedOrder?.bling_order_id || null,
        bling_order_number: updatedOrder?.bling_order_number || "",
        order: updatedOrder,
      });
    }

    if (!lockAcquired && ownsSyncAttempt) {
      const staleCheck = await findExistingBlingOrderByNumeroLoja(context, order.order_number, setStage);
      if (staleCheck) {
        const updatedOrder = await saveBlingLink(orderId, { data: staleCheck }, syncAttemptId);
        await insertOrderLog(orderId, user.id, "Pedido vinculado a pedido ja existente no Bling apos recuperar tentativa antiga.", {
          bling_order_id: updatedOrder?.bling_order_id || null,
          bling_order_number: updatedOrder?.bling_order_number || null,
        });
        return ok(request, {
          success: true,
          already_linked: true,
          bling_order_id: updatedOrder?.bling_order_id || null,
          bling_order_number: updatedOrder?.bling_order_number || "",
          order: updatedOrder,
        });
      }
    }

    const contact = await ensureBlingContactForOrder(context, order, setStage);
    console.info("bling-create-order contact resolved", {
      orderId,
      action: contact.action,
      blingContactId: contact.id,
    });

    const items = await buildItems(context, order, setStage);
    const blingPayload = buildBlingOrderPayload(order, items, contact.id);
    setStage("create_order");
    const blingResponse = await blingRequestWithTokenRefresh(context, "/pedidos/vendas", {
      method: "POST",
      body: blingPayload,
    });
    const updatedOrder = await saveBlingLink(orderId, blingResponse, syncAttemptId);

    await insertOrderLog(orderId, user.id, "Pedido enviado manualmente ao Bling pelo administrador.", {
      bling_order_id: updatedOrder?.bling_order_id || null,
      bling_order_number: updatedOrder?.bling_order_number || null,
    });

    return ok(request, {
      success: true,
      already_linked: false,
      bling_order_id: updatedOrder?.bling_order_id || null,
      bling_order_number: updatedOrder?.bling_order_number || "",
      order: updatedOrder,
    });
  } catch (error) {
    const blingError = error instanceof BlingHttpError ? summarizeBlingError(error) : null;

    if (orderId && ownsSyncAttempt && syncAttemptId) {
      const errorCode = error instanceof Error ? error.message : "";
      const message = error instanceof BlingHttpError
        ? blingErrorMessage(error, blingError?.message || "")
        : isBlingContactError(errorCode)
          ? validationMessage(errorCode)
        : "Nao foi possivel enviar o pedido ao Bling.";
      await markSyncError(orderId, syncAttemptId, error instanceof BlingHttpError ? "bling_api_error" : "internal_error", message);
    }

    if (error instanceof BlingHttpError) {
      console.error("bling-create-order BlingHttpError", stringifyLog({
        orderId,
        stage: currentStage,
        status: error.status,
        temporary: error.temporary,
        blingError,
      }));
      return fail(request, blingErrorMessage(error, blingError?.message || ""), error.temporary ? 503 : error.status, {
        code: "bling_api_error",
        stage: currentStage,
        status: error.status,
        bling_error: blingError,
      });
    }

    const message = error instanceof Error ? error.message : "Erro interno ao enviar pedido ao Bling.";
    console.error("bling-create-order", { orderId, message });

    if (message === "bling_not_connected") return fail(request, "Bling nao conectado.", 409, { code: message });
    if (message === "bling_not_active") return fail(request, "Conexao Bling nao esta ativa.", 409, { code: message });
    if (message === "bling_access_token_missing") return fail(request, "Access token do Bling ausente.", 409, { code: message });
    if (message === "bling_refresh_token_missing") return fail(request, "Refresh token do Bling ausente.", 409, { code: message });
    if (message === "bling_refresh_in_progress") return fail(request, "Token do Bling esta sendo renovado. Tente novamente em instantes.", 409, { code: message });
    if (message === "bling_refresh_lock_lost") return fail(request, "Outra tentativa renovou a conexao Bling. Tente novamente.", 409, { code: message });
    if (message === "bling_sync_lock_lost") return fail(request, "Outra tentativa alterou o envio ao Bling. Atualize o pedido e tente novamente.", 409, { code: message });
    if (isBlingContactError(message)) {
      return fail(request, validationMessage(message), 422, { code: message });
    }

    return fail(request, "Erro interno ao enviar pedido ao Bling.", 500);
  }
});
