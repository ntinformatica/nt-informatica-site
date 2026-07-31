import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest, supabaseRpc } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type StoreCustomer = {
  customer_name: string;
  customer_phone: string;
  customer_phone_normalized: string;
  customer_email: string;
  customer_document: string;
};

type StoreItem = {
  item_type: "product" | "assembled_pc";
  product_id?: string;
  variation_id?: string;
  assembled_pc_id?: string;
  quantity: number;
};

type CardInput = {
  token: string;
  payment_method_id: string;
  issuer_id: string;
};

type CheckoutInput = {
  customer: StoreCustomer;
  items: StoreItem[];
  payment_method: "pix" | "card";
  installments: number | null;
  idempotency_key: string;
  card?: CardInput;
};

const MAX_BODY_BYTES = 32 * 1024;
const MAX_ITEMS = 20;
const MERCADO_PAGO_ORDERS_URL = "https://api.mercadopago.com/v1/orders";
const MERCADO_PAGO_TIMEOUT_MS = 15000;
const FINAL_PAYMENT_STATUSES = new Set(["approved", "rejected", "cancelled", "expired", "refunded", "charged_back"]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEYS = new Set([
  "access_token",
  "authorization",
  "card",
  "card_number",
  "cardholder",
  "cvv",
  "document",
  "expiration_month",
  "expiration_year",
  "identification",
  "number",
  "security_code",
  "token",
]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function onlyDigits(value: unknown) {
  return cleanText(value).replace(/\D/g, "");
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nested(input: JsonObject, path: string[]) {
  let current: unknown = input;
  for (const key of path) {
    if (!isObject(current)) return "";
    current = current[key];
  }
  return current;
}

function unwrapCardPayload(input: JsonObject) {
  const formData = input.formData;
  if (isObject(formData)) return formData;
  const paymentData = input.paymentData;
  if (isObject(paymentData)) return paymentData;
  return input;
}

function firstText(values: unknown[]) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function isUuid(value: unknown) {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function isEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function safeMoney(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

function firstName(value: string) {
  return cleanText(value).split(/\s+/)[0]?.slice(0, 60) || "Cliente";
}

function lastName(value: string) {
  return cleanText(value).split(/\s+/).slice(1).join(" ").slice(0, 60);
}

function maskDocument(value: unknown) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.length <= 4 ? "****" : `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function maskEmail(value: unknown) {
  const email = cleanText(value).toLowerCase();
  if (!email.includes("@")) return "";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

async function readLimitedJson(request: Request): Promise<JsonObject> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("Body acima do limite permitido.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new Error("Body acima do limite permitido.");
  }
  if (!text.trim()) throw new Error("Body JSON obrigatorio.");

  try {
    const parsed = JSON.parse(text);
    if (!isObject(parsed)) throw new Error("Body JSON invalido.");
    return parsed;
  } catch {
    throw new Error("JSON invalido.");
  }
}

function validateCustomer(value: unknown, paymentMethod: "pix" | "card"): StoreCustomer {
  if (!isObject(value)) throw new Error("Dados do cliente invalidos.");

  const customerName = cleanText(value.customer_name || value.name);
  const customerPhone = cleanText(value.customer_phone || value.phone);
  const normalizedPhone = onlyDigits(value.customer_phone_normalized || value.phone_normalized || customerPhone);
  const customerEmail = cleanText(value.customer_email || value.email).toLowerCase();
  const customerDocument = onlyDigits(value.customer_document || value.document);

  if (!customerName) throw new Error("Nome do cliente obrigatorio.");
  if (!customerPhone || !normalizedPhone) throw new Error("Telefone do cliente obrigatorio.");
  if (paymentMethod === "card") {
    if (!customerDocument) throw new Error("Documento obrigatorio para cartao.");
    if (!customerEmail || !isEmail(customerEmail)) throw new Error("E-mail valido obrigatorio para cartao.");
  }
  if (customerEmail && !isEmail(customerEmail)) throw new Error("E-mail invalido.");

  return {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_phone_normalized: normalizedPhone,
    customer_email: customerEmail,
    customer_document: customerDocument,
  };
}

function validateItems(value: unknown): StoreItem[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Carrinho vazio.");
  if (value.length > MAX_ITEMS) throw new Error("Quantidade maxima de itens excedida.");

  return value.map((rawItem, index) => {
    if (!isObject(rawItem)) throw new Error(`Item ${index + 1} invalido.`);

    const itemType = cleanText(rawItem.item_type).toLowerCase();
    const quantity = Number(rawItem.quantity);
    if (itemType !== "product" && itemType !== "assembled_pc") {
      throw new Error(`Tipo de item invalido no item ${index + 1}.`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Quantidade invalida no item ${index + 1}.`);
    }

    if (itemType === "product") {
      if (!isUuid(rawItem.product_id)) throw new Error(`Produto invalido no item ${index + 1}.`);
      if (rawItem.variation_id !== undefined && rawItem.variation_id !== null && cleanText(rawItem.variation_id) && !isUuid(rawItem.variation_id)) {
        throw new Error(`Variacao invalida no item ${index + 1}.`);
      }
      return {
        item_type: "product",
        product_id: String(rawItem.product_id),
        variation_id: cleanText(rawItem.variation_id) || undefined,
        quantity,
      };
    }

    if (!isUuid(rawItem.assembled_pc_id)) throw new Error(`PC montado invalido no item ${index + 1}.`);
    return {
      item_type: "assembled_pc",
      assembled_pc_id: String(rawItem.assembled_pc_id),
      quantity,
    };
  });
}

function validateCard(value: unknown): CardInput {
  if (!isObject(value)) throw new Error("Dados do cartao obrigatorios.");

  const cardPayload = unwrapCardPayload(value);
  const token = firstText([
    cardPayload.token,
    cardPayload.cardToken,
    nested(cardPayload, ["payment_method", "token"]),
  ]);
  const paymentMethodId = firstText([
    cardPayload.payment_method_id,
    cardPayload.paymentMethodId,
    nested(cardPayload, ["payment_method", "id"]),
  ]).toLowerCase();
  const issuerId = firstText([
    cardPayload.issuer_id,
    cardPayload.issuerId,
    nested(cardPayload, ["issuer", "id"]),
    nested(cardPayload, ["payment_method", "issuer_id"]),
  ]);
  const paymentTypeId = firstText([
    cardPayload.payment_type_id,
    cardPayload.paymentTypeId,
    nested(cardPayload, ["payment_method", "type"]),
  ]).toLowerCase();

  if (!token) throw new Error("Token do cartao nao informado.");
  if (!paymentMethodId) throw new Error("Bandeira do cartao nao informada.");
  if (paymentTypeId && paymentTypeId !== "credit_card") throw new Error("Somente cartao de credito e aceito.");

  return {
    token,
    payment_method_id: paymentMethodId,
    issuer_id: issuerId,
  };
}

function validateCheckoutPayload(payload: JsonObject): CheckoutInput {
  const paymentMethod = cleanText(payload.payment_method || payload.paymentMethod).toLowerCase();
  if (paymentMethod !== "pix" && paymentMethod !== "card") {
    throw new Error("Forma de pagamento invalida.");
  }

  const idempotencyKey = cleanText(payload.idempotency_key || payload.idempotencyKey);
  if (!idempotencyKey) throw new Error("Chave de idempotencia obrigatoria.");
  if (idempotencyKey.length > 160) throw new Error("Chave de idempotencia muito longa.");

  const installmentsInput = payload.installments === undefined || payload.installments === null ? null : Number(payload.installments);
  let installments: number | null = paymentMethod === "pix" ? 1 : installmentsInput;
  if (paymentMethod === "pix" && installmentsInput !== null && installmentsInput !== 1) {
    throw new Error("Pix nao permite parcelamento.");
  }
  if (paymentMethod === "card") {
    installments = installments || 1;
    if (!Number.isInteger(installments) || installments < 1 || installments > 10) {
      throw new Error("Cartao permite de 1 a 10 parcelas.");
    }
  }

  return {
    customer: validateCustomer(payload.customer, paymentMethod),
    items: validateItems(payload.items),
    payment_method: paymentMethod,
    installments,
    idempotency_key: idempotencyKey,
    card: paymentMethod === "card" ? validateCard(payload.card) : undefined,
  };
}

function fromRows(rows: unknown) {
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function mercadoPagoHeaders(idempotencyKey = "") {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
  return headers;
}

async function mercadoPagoRequest(body: JsonObject, idempotencyKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MERCADO_PAGO_TIMEOUT_MS);

  try {
    const response = await fetch(MERCADO_PAGO_ORDERS_URL, {
      method: "POST",
      headers: mercadoPagoHeaders(idempotencyKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const temporary = response.status === 409 || response.status === 429 || response.status >= 500;
      return {
        ok: false,
        status: response.status,
        temporary,
        payload,
      };
    }

    return {
      ok: true,
      status: response.status,
      temporary: false,
      payload: payload as JsonObject,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, status: 504, temporary: true, payload: { message: "Timeout ao chamar Mercado Pago." } };
    }
    return {
      ok: false,
      status: 503,
      temporary: true,
      payload: { message: error instanceof Error ? error.message : "Falha de conexao com Mercado Pago." },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeDeep(input: unknown, parentKey = ""): unknown {
  if (Array.isArray(input)) return input.map((item) => sanitizeDeep(item, parentKey));
  if (!input || typeof input !== "object") return input;

  const result: JsonObject = {};
  for (const [key, value] of Object.entries(input as JsonObject)) {
    const normalizedKey = key.toLowerCase();
    const compoundKey = parentKey ? `${parentKey}.${normalizedKey}` : normalizedKey;
    if (
      SENSITIVE_KEYS.has(normalizedKey)
      || compoundKey.endsWith("payer.identification.number")
      || compoundKey.endsWith("identification.number")
      || normalizedKey.includes("security")
      || normalizedKey.includes("authorization")
      || normalizedKey.includes("access_token")
      || normalizedKey.includes("card_number")
    ) {
      result[key] = "[removed]";
      continue;
    }
    result[key] = sanitizeDeep(value, compoundKey);
  }
  return result;
}

function findDeepStrings(input: unknown, matcher: (key: string, value: string) => boolean, keyPath = ""): string[] {
  if (!input || typeof input !== "object") return [];
  const results: string[] = [];
  for (const [key, value] of Object.entries(input as JsonObject)) {
    const nextPath = keyPath ? `${keyPath}.${key}` : key;
    if (typeof value === "string" && matcher(nextPath.toLowerCase(), value)) {
      results.push(value);
    } else if (value && typeof value === "object") {
      results.push(...findDeepStrings(value, matcher, nextPath));
    }
  }
  return results;
}

function firstString(values: unknown[]) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function mercadoPagoOrderId(order: JsonObject) {
  return firstString([order.id, order.order_id, order.external_resource_url]);
}

function mercadoPagoExternalReference(order: JsonObject) {
  return firstString([order.external_reference]);
}

function mercadoPagoPaymentTransaction(order: JsonObject) {
  const transactions = order.transactions as JsonObject | undefined;
  const payments = transactions?.payments;
  return Array.isArray(payments) ? payments[0] as JsonObject | undefined : undefined;
}

function mercadoPagoPaymentTransactionId(order: JsonObject) {
  const payment = mercadoPagoPaymentTransaction(order);
  return firstString([payment?.id, payment?.payment_id, payment?.reference_id]);
}

function mercadoPagoPaymentMethod(order: JsonObject) {
  const payment = mercadoPagoPaymentTransaction(order);
  const method = payment?.payment_method;
  return method && typeof method === "object" ? method as JsonObject : {};
}

function mapMercadoPagoStatus(status: unknown) {
  const normalized = cleanText(status).toLowerCase();
  if (["paid", "approved", "processed", "accredited"].includes(normalized)) return "approved";
  if (["processing", "in_process", "in_mediation"].includes(normalized)) return "processing";
  if (["pending", "created"].includes(normalized)) return "pending";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  if (normalized === "expired") return "expired";
  if (["rejected", "failed"].includes(normalized)) return "rejected";
  if (normalized === "refunded") return "refunded";
  if (normalized === "charged_back") return "charged_back";
  return "processing";
}

function isLikelyPixCopyPaste(value: string) {
  return /^000201/i.test(value.trim()) || value.toLowerCase().includes("br.gov.bcb.pix");
}

function isLikelyBase64Image(value: string) {
  return value.length > 120 && /^[a-z0-9+/=\s]+$/i.test(value);
}

function extractPixPayload(order: JsonObject) {
  const copyCandidates = findDeepStrings(order, (key, value) =>
    (key.includes("qr") || key.includes("pix") || key.includes("copy") || key.includes("paste"))
    && isLikelyPixCopyPaste(value)
  );
  const base64Candidates = findDeepStrings(order, (key, value) =>
    key.includes("qr") && key.includes("base64") && isLikelyBase64Image(value)
  );
  const ticketCandidates = findDeepStrings(order, (key, value) =>
    (key.includes("ticket") || key.includes("voucher") || key.includes("transaction")) && /^https?:\/\//i.test(value)
  );

  return {
    qr_code: firstString(copyCandidates),
    qr_code_base64: firstString(base64Candidates).replace(/^data:image\/[a-z]+;base64,/i, ""),
    ticket_url: firstString(ticketCandidates),
  };
}

function expirationDuration(expiresAt: unknown) {
  const expiresAtMs = new Date(String(expiresAt || "")).getTime();
  if (!Number.isFinite(expiresAtMs)) return "";
  const remainingMinutes = Math.floor((expiresAtMs - Date.now()) / 60000);
  if (remainingMinutes <= 0) return "";
  return `PT${remainingMinutes}M`;
}

function buildDescription(order: JsonObject) {
  return `Pedido NT Informatica ${order.order_number || order.order_id || ""}`.trim().slice(0, 120);
}

function buildPixOrderBody(params: {
  order: JsonObject;
  payment: JsonObject;
  customer: StoreCustomer;
  expirationTime: string;
}) {
  const { order, payment, customer, expirationTime } = params;
  const amount = safeMoney(payment.amount || order.total_amount);

  const payer: JsonObject = {
    email: customer.customer_email || payment.payer_email || "ntinformaticacomercial@gmail.com",
    first_name: firstName(customer.customer_name),
  };

  return {
    type: "online",
    processing_mode: "automatic",
    external_reference: payment.external_reference,
    description: buildDescription(order),
    total_amount: amount.toFixed(2),
    payer,
    transactions: {
      payments: [
        {
          amount: amount.toFixed(2),
          payment_method: { id: "pix", type: "bank_transfer" },
          expiration_time: expirationTime,
        },
      ],
    },
  };
}

function buildCardOrderBody(params: {
  order: JsonObject;
  payment: JsonObject;
  customer: StoreCustomer;
  card: CardInput;
  installments: number;
}) {
  const { order, payment, customer, card, installments } = params;
  const amount = safeMoney(payment.amount || order.total_amount);
  const payer: JsonObject = {
    email: customer.customer_email || payment.payer_email,
    first_name: firstName(customer.customer_name),
    identification: {
      type: "CPF",
      number: onlyDigits(customer.customer_document),
    },
  };
  const surname = lastName(customer.customer_name);
  if (surname) payer.last_name = surname;

  return {
    type: "online",
    processing_mode: "automatic",
    external_reference: payment.external_reference,
    description: buildDescription(order),
    total_amount: amount.toFixed(2),
    payer,
    transactions: {
      payments: [
        {
          amount: amount.toFixed(2),
          payment_method: {
            id: card.payment_method_id,
            type: "credit_card",
            token: card.token,
            installments,
          },
        },
      ],
    },
  };
}

async function loadStorePayment(paymentId: unknown) {
  if (!isUuid(paymentId)) throw new Error("Pagamento interno invalido.");
  return await getSingle(
    `/store_payments?id=eq.${encodeURIComponent(String(paymentId))}`
    + "&select=id,order_id,provider,payment_method,payment_type,status,status_detail,amount,currency,installments,installment_amount,external_reference,mercado_pago_order_id,mercado_pago_payment_id,mercado_pago_transaction_id,qr_code,qr_code_base64,ticket_url,payer_email,payer_document_masked,card_brand,card_last_four,raw_response,metadata,expires_at,approved_at,paid_at,created_at,updated_at&limit=1",
  ) as JsonObject | null;
}

function hasProviderPayment(payment: JsonObject) {
  return Boolean(
    cleanText(payment.mercado_pago_order_id)
    || cleanText(payment.mercado_pago_payment_id)
    || cleanText(payment.mercado_pago_transaction_id)
    || cleanText(payment.qr_code)
    || cleanText(payment.ticket_url)
  );
}

function publicOrder(order: JsonObject) {
  return {
    id: order.order_id,
    number: order.order_number,
    checkout_token: order.checkout_token,
    financial_status: order.financial_status,
    operational_status: order.operational_status,
    subtotal: safeMoney(order.subtotal_amount),
    discount: safeMoney(order.discount_amount),
    total: safeMoney(order.total_amount),
    installments: order.installments,
    installment_amount: order.installment_amount,
    expires_at: order.expires_at,
  };
}

function publicPayment(payment: JsonObject, paymentMethod: "pix" | "card") {
  const response: JsonObject = {
    id: payment.id,
    method: paymentMethod,
    status: payment.status,
    status_detail: payment.status_detail,
    expires_at: payment.expires_at,
  };

  if (paymentMethod === "pix") {
    response.qr_code = payment.qr_code || "";
    response.qr_code_base64 = payment.qr_code_base64 || "";
    response.ticket_url = payment.ticket_url || "";
  } else {
    response.mercado_pago_payment_id = payment.mercado_pago_payment_id || payment.mercado_pago_order_id || "";
    response.installments = payment.installments;
    response.installment_amount = payment.installment_amount;
  }

  return response;
}

async function patchStorePayment(paymentId: string, values: JsonObject) {
  const rows = await supabaseRest(`/store_payments?id=eq.${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
  return fromRows(rows) as JsonObject | null;
}

async function patchStoreOrder(orderId: string, values: JsonObject) {
  const rows = await supabaseRest(`/store_orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
  return fromRows(rows) as JsonObject | null;
}

async function insertStorePaymentEvent(event: JsonObject) {
  await supabaseRest("/store_payment_events", {
    method: "POST",
    body: JSON.stringify(event),
  }).catch((error) => {
    const message = String(error?.message || "");
    if (!message.includes("duplicate key") && !message.includes("store_payment_events_provider_event_uidx")) throw error;
  });
}

function providerErrorMessage(status: number) {
  if (status === 400 || status === 422) return "Dados de pagamento recusados pelo Mercado Pago.";
  if (status === 401 || status === 403) return "Credenciais do Mercado Pago indisponiveis para o checkout.";
  if (status === 404) return "Recurso de pagamento nao encontrado no Mercado Pago.";
  if (status === 409) return "Conflito temporario ao criar pagamento. Tente novamente.";
  if (status === 429) return "Mercado Pago recebeu muitas tentativas. Tente novamente em instantes.";
  if (status >= 500) return "Mercado Pago indisponivel no momento.";
  return "Falha ao criar pagamento no Mercado Pago.";
}

function providerDetail(payload: unknown) {
  if (!isObject(payload)) return cleanText(payload);
  return firstString([
    payload.status_detail,
    ...findDeepStrings(payload, (key, value) => key.endsWith("status_detail") && Boolean(value)),
    payload.code,
    payload.error,
    payload.message,
    ...findDeepStrings(payload, (key, value) =>
      ["code", "error", "message"].some((name) => key.endsWith(name)) && Boolean(value)
    ),
    payload.status,
    ...findDeepStrings(payload, (key, value) => key.endsWith("status") && Boolean(value)),
  ]);
}

function cardRejectionMessage(status: unknown, statusDetail: unknown) {
  const normalized = `${cleanText(status)} ${cleanText(statusDetail)}`.toLowerCase();
  if (normalized.includes("insufficient_amount") || normalized.includes("insufficient_funds") || normalized.includes("insufficient")) {
    return "Pagamento recusado por limite insuficiente. Verifique seu limite ou tente outro cartao.";
  }
  if (normalized.includes("invalid_installments") || normalized.includes("installments")) {
    return "A quantidade de parcelas selecionada nao e aceita por este cartao.";
  }
  if (normalized.includes("high_risk") || normalized.includes("risk")) {
    return "O pagamento nao foi autorizado. Tente outro meio de pagamento.";
  }
  if (normalized.includes("invalid") || normalized.includes("bad_filled") || normalized.includes("badfilled")) {
    return "Dados do cartao invalidos. Confira as informacoes e tente novamente.";
  }
  if (normalized.includes("unauthorized") || normalized.includes("not_authorized") || normalized.includes("call_for_authorize")) {
    return "Cartao nao autorizado. Fale com o banco ou tente outro cartao.";
  }
  if (normalized.includes("processing") || normalized.includes("in_process")) {
    return "Pagamento em processamento. Aguarde a confirmacao.";
  }
  return "Pagamento recusado. Tente outro cartao ou outra forma de pagamento.";
}

function isCardRejection(status: unknown, statusDetail: unknown) {
  const normalized = `${cleanText(status)} ${cleanText(statusDetail)}`.toLowerCase();
  return (
    normalized.includes("cc_rejected")
    || normalized.includes("rejected")
    || normalized.includes("failed")
    || normalized.includes("insufficient")
    || normalized.includes("bad_filled")
    || normalized.includes("badfilled")
    || normalized.includes("high_risk")
    || normalized.includes("invalid_installments")
    || normalized.includes("not_authorized")
    || normalized.includes("unauthorized")
    || normalized.includes("call_for_authorize")
  );
}

function cardStatusInfo(order: JsonObject) {
  const transaction = mercadoPagoPaymentTransaction(order) || {};
  const statusDetails = findDeepStrings(order, (key, value) => key.endsWith("status_detail") && Boolean(value));
  const statuses = findDeepStrings(order, (key, value) => key.endsWith("status") && Boolean(value));
  const transactionStatus = firstString([transaction.status, ...statuses]);
  const transactionStatusDetail = firstString([transaction.status_detail, ...statusDetails]);

  return {
    orderStatus: cleanText(order.status),
    orderStatusDetail: cleanText(order.status_detail),
    transactionStatus,
    transactionStatusDetail,
    statusDetail: firstString([transactionStatusDetail, order.status_detail, ...statusDetails]),
    status: firstString([transactionStatus, order.status, ...statuses]),
  };
}

function logCardStatusStructure(params: {
  orderId: unknown;
  paymentId: unknown;
  httpStatus: number;
  providerOrderId?: string;
  transactionId?: string;
  statusInfo: ReturnType<typeof cardStatusInfo>;
  mappedStatus: string;
}) {
  const { orderId, paymentId, httpStatus, providerOrderId = "", transactionId = "", statusInfo, mappedStatus } = params;
  console.info("Mercado Pago card status structure.", {
    orderId,
    paymentId,
    httpStatus,
    providerOrderId,
    transactionId,
    orderStatus: statusInfo.orderStatus,
    orderStatusDetail: statusInfo.orderStatusDetail,
    transactionStatus: statusInfo.transactionStatus,
    transactionStatusDetail: statusInfo.transactionStatusDetail,
    mappedStatus,
  });
}

async function markCardPaymentRejected(params: {
  order: JsonObject;
  payment: JsonObject;
  statusDetail: string;
  sanitizedPayload: unknown;
  providerStatus?: number;
}) {
  const { order, payment, statusDetail, sanitizedPayload, providerStatus } = params;
  const now = new Date().toISOString();
  const paymentId = String(payment.id || "");
  const orderId = String(order.order_id || payment.order_id || "");

  let rejectedPayment = payment;
  if (paymentId) {
    rejectedPayment = await patchStorePayment(paymentId, {
      status: "rejected",
      status_detail: statusDetail,
      raw_response: { mercadoPagoRejection: sanitizedPayload },
      metadata: {
        ...(isObject(payment.metadata) ? payment.metadata : {}),
        lastProviderRejectionAt: now,
        lastProviderErrorStatus: providerStatus || null,
      },
    }) || payment;
  }

  if (orderId) {
    await patchStoreOrder(orderId, {
      financial_status: "rejected",
      operational_status: "cancelled",
      cancelled_at: now,
      metadata: {
        ...(isObject(order.metadata) ? order.metadata : {}),
        rejectedBy: "store-create-checkout",
        rejectedAt: now,
        rejectionStatusDetail: statusDetail,
      },
    }).catch((error) => {
      console.warn("Falha ao marcar pedido recusado no checkout.", error);
    });
  }

  await insertStorePaymentEvent({
    payment_id: rejectedPayment.id,
    provider: "mercado_pago",
    provider_event_id: `${rejectedPayment.id}:card-rejected:${statusDetail || providerStatus || Date.now()}`,
    event_type: "store_payment.card_rejected",
    event_status: "rejected",
    payload: sanitizedPayload,
    processed: true,
    processed_at: now,
  });

  console.info("Pagamento com cartao recusado.", {
    orderId,
    paymentId,
    status: "rejected",
    statusDetail,
    providerStatus: providerStatus || null,
  });

  return rejectedPayment;
}

function checkoutErrorStatus(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("estoque insuficiente")) return 409;
  if (normalized.includes("indisponivel") || normalized.includes("indisponível")) return 422;
  if (normalized.includes("nao encontrado") || normalized.includes("não encontrado")) return 404;
  if (
    normalized.includes("json")
    || normalized.includes("obrigatorio")
    || normalized.includes("obrigatório")
    || normalized.includes("invalido")
    || normalized.includes("inválido")
    || normalized.includes("carrinho")
    || normalized.includes("quantidade")
    || normalized.includes("limite")
    || normalized.includes("parcelamento")
    || normalized.includes("cartao")
    || normalized.includes("cartão")
  ) {
    return 400;
  }
  return 500;
}

function checkoutPublicError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("estoque insuficiente")) return "Estoque insuficiente.";
  if (normalized.includes("indisponivel") || normalized.includes("indisponível")) return "Item indisponivel para venda.";
  if (normalized.includes("nao encontrado") || normalized.includes("não encontrado")) return "Item nao encontrado.";
  if (checkoutErrorStatus(message) < 500) return message;
  return "Falha ao criar checkout.";
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const input = validateCheckoutPayload(await readLimitedJson(request));
    const rpcResult = await supabaseRpc("create_store_order_from_cart", {
      p_customer: input.customer,
      p_items: input.items,
      p_payment_method: input.payment_method,
      p_installments: input.installments,
      p_order_source: "site",
      p_idempotency_key: input.idempotency_key,
    }) as JsonObject;
    const order = fromRows(rpcResult) as JsonObject | null;

    if (!order?.order_id) return fail(request, "Nao foi possivel criar o pedido.", 500);
    if (!order.payment_id) return fail(request, "Pagamento interno nao foi criado.", 500);

    let payment = await loadStorePayment(order.payment_id);
    if (!payment) return fail(request, "Pagamento interno nao encontrado.", 500);
    if (String(payment.order_id) !== String(order.order_id)) return fail(request, "Pagamento interno inconsistente.", 500);

    if (FINAL_PAYMENT_STATUSES.has(cleanText(payment.status))) {
      return ok(request, {
        order: publicOrder(order),
        payment: publicPayment(payment, input.payment_method),
        idempotent: Boolean(order.idempotent),
      });
    }

    if (hasProviderPayment(payment)) {
      return ok(request, {
        order: publicOrder(order),
        payment: publicPayment(payment, input.payment_method),
        idempotent: true,
      });
    }

    if (input.payment_method === "pix") {
      const expirationTime = expirationDuration(payment.expires_at || order.expires_at);
      if (!expirationTime) {
        await patchStorePayment(String(payment.id), {
          status: "expired",
          status_detail: "expired_before_provider_payment",
          metadata: {
            ...(isObject(payment.metadata) ? payment.metadata : {}),
            expiredBeforeProviderPaymentAt: new Date().toISOString(),
          },
        });
        return fail(request, "Pedido expirado. Monte o carrinho novamente.", 409);
      }

      const body = buildPixOrderBody({ order, payment, customer: input.customer, expirationTime });
      const mpResponse = await mercadoPagoRequest(body, `store-payment:${payment.id}`);
      const sanitizedPayload = sanitizeDeep(mpResponse.payload);

      if (!mpResponse.ok) {
        await patchStorePayment(String(payment.id), {
          raw_response: { mercadoPagoError: sanitizedPayload },
          metadata: {
            ...(isObject(payment.metadata) ? payment.metadata : {}),
            lastProviderErrorAt: new Date().toISOString(),
            lastProviderErrorStatus: mpResponse.status,
          },
        });
        return fail(request, providerErrorMessage(mpResponse.status), mpResponse.temporary ? 503 : 422);
      }

      const mercadoPagoOrder = mpResponse.payload as JsonObject;
      const pix = extractPixPayload(mercadoPagoOrder);
      const providerOrderId = mercadoPagoOrderId(mercadoPagoOrder);
      const transaction = mercadoPagoPaymentTransaction(mercadoPagoOrder) || {};
      const transactionId = mercadoPagoPaymentTransactionId(mercadoPagoOrder);
      const mappedStatus = mapMercadoPagoStatus(transaction.status || transaction.status_detail || mercadoPagoOrder.status || mercadoPagoOrder.status_detail || "pending");

      payment = await patchStorePayment(String(payment.id), {
        mercado_pago_order_id: providerOrderId || null,
        mercado_pago_payment_id: transactionId || providerOrderId || null,
        mercado_pago_transaction_id: transactionId || null,
        status: mappedStatus,
        status_detail: cleanText(transaction.status_detail || mercadoPagoOrder.status_detail),
        qr_code: pix.qr_code || null,
        qr_code_base64: pix.qr_code_base64 || null,
        ticket_url: pix.ticket_url || null,
        raw_response: { mercadoPagoOrder: sanitizedPayload },
        metadata: {
          ...(isObject(payment.metadata) ? payment.metadata : {}),
          mercadoPagoOrderId: providerOrderId || "",
          mercadoPagoTransactionId: transactionId || "",
          pixGeneratedAt: new Date().toISOString(),
        },
      }) || payment;

      await insertStorePaymentEvent({
        payment_id: payment.id,
        provider: "mercado_pago",
        provider_event_id: `${payment.id}:order-created:${providerOrderId || transactionId || Date.now()}`,
        event_type: "store_payment.pix_created",
        event_status: mappedStatus,
        payload: sanitizedPayload,
        processed: true,
        processed_at: new Date().toISOString(),
      });

      return ok(request, {
        order: publicOrder(order),
        payment: publicPayment(payment, "pix"),
        idempotent: Boolean(order.idempotent),
      });
    }

    const body = buildCardOrderBody({
      order,
      payment,
      customer: input.customer,
      card: input.card as CardInput,
      installments: input.installments || 1,
    });
    const mpResponse = await mercadoPagoRequest(body, `store-payment:${payment.id}`);
    const sanitizedPayload = sanitizeDeep(mpResponse.payload);

    if (!mpResponse.ok) {
      const statusDetail = providerDetail(mpResponse.payload) || `http_${mpResponse.status}`;
      const rejectedByProvider = isCardRejection("", statusDetail);
      console.info("Mercado Pago card error structure.", {
        orderId: order.order_id,
        paymentId: payment.id,
        httpStatus: mpResponse.status,
        statusDetail,
        rejectedByProvider,
      });
      if (!mpResponse.temporary && rejectedByProvider) {
        payment = await markCardPaymentRejected({
          order,
          payment,
          statusDetail,
          sanitizedPayload,
          providerStatus: mpResponse.status,
        });
        return fail(request, cardRejectionMessage("rejected", statusDetail), 402, {
          order: publicOrder({ ...order, financial_status: "rejected", operational_status: "cancelled" }),
          payment: publicPayment(payment, "card"),
          status: "rejected",
          status_detail: statusDetail,
        });
      }

      await patchStorePayment(String(payment.id), {
        raw_response: { mercadoPagoError: sanitizedPayload },
        metadata: {
          ...(isObject(payment.metadata) ? payment.metadata : {}),
          lastProviderErrorAt: new Date().toISOString(),
          lastProviderErrorStatus: mpResponse.status,
        },
      });
      return fail(request, providerErrorMessage(mpResponse.status), mpResponse.temporary ? 503 : 422);
    }

    const mercadoPagoOrder = mpResponse.payload as JsonObject;
    const providerOrderId = mercadoPagoOrderId(mercadoPagoOrder);
    const transaction = mercadoPagoPaymentTransaction(mercadoPagoOrder) || {};
    const transactionId = mercadoPagoPaymentTransactionId(mercadoPagoOrder);
    const method = mercadoPagoPaymentMethod(mercadoPagoOrder);
    const statusInfo = cardStatusInfo(mercadoPagoOrder);
    const statusDetail = statusInfo.statusDetail;
    const mappedStatus = isCardRejection(statusInfo.status, statusDetail)
      ? "rejected"
      : mapMercadoPagoStatus(statusInfo.status || statusDetail || "pending");
    const cardBrand = firstString([method.id, input.card?.payment_method_id]);
    const cardLastFour = firstString([
      method.last_four_digits,
      method.last_four,
      method.last4,
      isObject(method.card) ? method.card.last_four_digits : "",
    ]).replace(/\D/g, "").slice(-4);

    logCardStatusStructure({
      orderId: order.order_id,
      paymentId: payment.id,
      httpStatus: mpResponse.status,
      providerOrderId,
      transactionId,
      statusInfo,
      mappedStatus,
    });

    payment = await patchStorePayment(String(payment.id), {
      mercado_pago_order_id: providerOrderId || null,
      mercado_pago_payment_id: transactionId || providerOrderId || null,
      mercado_pago_transaction_id: transactionId || null,
      status: mappedStatus,
      status_detail: statusDetail,
      payment_type: "credit_card",
      installments: input.installments || 1,
      payer_email: input.customer.customer_email,
      payer_document_masked: maskDocument(input.customer.customer_document),
      card_brand: cardBrand || null,
      card_last_four: cardLastFour || "",
      raw_response: { mercadoPagoOrder: sanitizedPayload },
      metadata: {
        ...(isObject(payment.metadata) ? payment.metadata : {}),
        mercadoPagoOrderId: providerOrderId || "",
        mercadoPagoTransactionId: transactionId || "",
        cardProcessedAt: new Date().toISOString(),
      },
    }) || payment;

    await insertStorePaymentEvent({
      payment_id: payment.id,
      provider: "mercado_pago",
      provider_event_id: `${payment.id}:card-order-created:${providerOrderId || transactionId || Date.now()}`,
      event_type: "store_payment.card_created",
      event_status: mappedStatus,
      payload: sanitizedPayload,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    if (mappedStatus === "rejected") {
      payment = await markCardPaymentRejected({
        order,
        payment,
        statusDetail,
        sanitizedPayload,
        providerStatus: mpResponse.status,
      });
      return fail(request, cardRejectionMessage(mappedStatus, statusDetail), 402, {
        order: publicOrder({ ...order, financial_status: "rejected", operational_status: "cancelled" }),
        payment: publicPayment(payment, "card"),
        status: mappedStatus,
        status_detail: statusDetail,
      });
    }

    return ok(request, {
      order: publicOrder(order),
      payment: publicPayment(payment, "card"),
      idempotent: Boolean(order.idempotent),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar checkout.";
    console.error("store-create-checkout", {
      message,
      safe: true,
    });
    return fail(request, checkoutPublicError(message), checkoutErrorStatus(message));
  }
});
