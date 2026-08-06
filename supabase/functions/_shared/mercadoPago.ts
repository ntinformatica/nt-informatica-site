import { safeMoney } from "./validation.ts";

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
}

function mercadoPagoHeaders(idempotencyKey = "") {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env("MERCADO_PAGO_ACCESS_TOKEN")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
  return headers;
}

export class MercadoPagoHttpError extends Error {
  status: number;
  payload: unknown;
  temporary: boolean;

  constructor(status: number, payload: unknown) {
    super(typeof payload === "string" ? payload : JSON.stringify(payload));
    this.name = "MercadoPagoHttpError";
    this.status = status;
    this.payload = payload;
    this.temporary = status === 429 || status >= 500;
  }
}

async function mercadoPagoRequest(path: string, options: RequestInit = {}) {
  const timeoutMs = Number(options.signal ? 0 : 15000);
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      ...options,
      signal: options.signal || controller?.signal,
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
      throw new MercadoPagoHttpError(response.status, payload);
    }

    return payload as Record<string, unknown>;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MercadoPagoHttpError(504, { message: "Timeout ao chamar Mercado Pago." });
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function firstString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function findDeepStrings(input: unknown, matcher: (key: string, value: string) => boolean, keyPath = ""): string[] {
  if (!input || typeof input !== "object") return [];
  const results: string[] = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const nextPath = keyPath ? `${keyPath}.${key}` : key;
    if (typeof value === "string" && matcher(nextPath.toLowerCase(), value)) {
      results.push(value);
    } else if (value && typeof value === "object") {
      results.push(...findDeepStrings(value, matcher, nextPath));
    }
  }
  return results;
}

function isLikelyPixCopyPaste(value: string) {
  return /^000201/i.test(value.trim()) || value.toLowerCase().includes("br.gov.bcb.pix");
}

function isLikelyBase64Image(value: string) {
  return value.length > 120 && /^[a-z0-9+/=\s]+$/i.test(value);
}

export function extractPixPayload(order: Record<string, unknown>) {
  const copyCandidates = findDeepStrings(order, (key, value) => (
    (key.includes("qr") || key.includes("pix") || key.includes("copy") || key.includes("paste"))
    && isLikelyPixCopyPaste(value)
  ));
  const base64Candidates = findDeepStrings(order, (key, value) => (
    key.includes("qr") && key.includes("base64") && isLikelyBase64Image(value)
  ));
  const ticketCandidates = findDeepStrings(order, (key, value) => (
    (key.includes("ticket") || key.includes("voucher") || key.includes("transaction")) && /^https?:\/\//i.test(value)
  ));

  return {
    pixCopyPaste: firstString(copyCandidates),
    qrCodeBase64: firstString(base64Candidates).replace(/^data:image\/[a-z]+;base64,/i, ""),
    ticketUrl: firstString(ticketCandidates),
  };
}

export function mercadoPagoOrderId(order: Record<string, unknown>) {
  return firstString([
    order.id,
    order.order_id,
    order.external_resource_url,
  ]);
}

export function mercadoPagoExternalReference(order: Record<string, unknown>) {
  return firstString([
    order.external_reference,
  ]);
}

export function mercadoPagoPaymentTransaction(order: Record<string, unknown>) {
  const transactions = order.transactions as Record<string, unknown> | undefined;
  const payments = transactions?.payments;
  return Array.isArray(payments) ? payments[0] as Record<string, unknown> | undefined : undefined;
}

export function mercadoPagoPaymentTransactionId(order: Record<string, unknown>) {
  const payment = mercadoPagoPaymentTransaction(order);
  return firstString([
    payment?.id,
    payment?.payment_id,
    payment?.reference_id,
  ]);
}

export function mercadoPagoPaymentMethod(order: Record<string, unknown>) {
  const payment = mercadoPagoPaymentTransaction(order);
  const method = payment?.payment_method;
  return method && typeof method === "object" ? method as Record<string, unknown> : {};
}

export function sanitizeMercadoPagoPayload(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => sanitizeMercadoPagoPayload(item));
  if (!input || typeof input !== "object") return input;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (["token", "security_code", "cvv"].includes(normalizedKey)) continue;
    if (normalizedKey.includes("card_number")) continue;
    if (normalizedKey.includes("expiration_month")) continue;
    if (normalizedKey.includes("expiration_year")) continue;
    if (normalizedKey.includes("card_expiration")) continue;
    result[key] = sanitizeMercadoPagoPayload(value);
  }
  return result;
}

export function mapMercadoPagoStatus(status: unknown) {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "approved", "processed", "accredited"].includes(normalized)) return "paid";
  if (["processing", "in_process", "in_mediation"].includes(normalized)) return "processing";
  if (["pending", "created"].includes(normalized)) return "pending";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  if (["expired"].includes(normalized)) return "expired";
  if (["rejected", "failed"].includes(normalized)) return "failed";
  if (["refunded", "charged_back"].includes(normalized)) return "refunded";
  return "processing";
}

export async function createPixOrder(params: {
  payment: Record<string, unknown>;
  reservation: Record<string, unknown>;
  idempotencyKey: string;
  expirationTime: string;
}) {
  const { payment, reservation, idempotencyKey, expirationTime } = params;
  const amount = safeMoney(payment.amount);
  const description = `Reserva NT Arena Gamer ${reservation.reservation_date || ""} ${reservation.start_time || ""}`.trim();

  const body = {
    type: "online",
    processing_mode: "automatic",
    external_reference: payment.id,
    description,
    total_amount: amount.toFixed(2),
    payer: {
      email: String(
        reservation.customer_email ||
        payment.customer_email ||
        "ntinformaticacomercial@gmail.com"
      ).trim(),
      first_name: String(
        reservation.customer_name || "Cliente NT"
      ).slice(0, 60),
    },
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

  return mercadoPagoRequest("/v1/orders", {
    method: "POST",
    headers: mercadoPagoHeaders(idempotencyKey),
    body: JSON.stringify(body),
  });
}

export async function createPlanPixOrder(params: {
  planPayment: Record<string, unknown>;
  idempotencyKey: string;
  expirationTime: string;
}) {
  const { planPayment, idempotencyKey, expirationTime } = params;
  const amount = safeMoney(planPayment.amount);
  const hours = Number(planPayment.purchased_hours || 0);
  const description = `${planPayment.plan_name || "Plano Arena Gamer"} - ${hours} horas por ${planPayment.validity_days || 30} dias`.trim();

  const body = {
    type: "online",
    processing_mode: "automatic",
    external_reference: planPayment.id,
    description,
    total_amount: amount.toFixed(2),
    payer: {
      email: "ntinformaticacomercial@gmail.com",
      first_name: String(
        planPayment.customer_name || "Cliente NT"
      ).slice(0, 60),
    },
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

  return mercadoPagoRequest("/v1/orders", {
    method: "POST",
    headers: mercadoPagoHeaders(idempotencyKey),
    body: JSON.stringify(body),
  });
}

export async function createPlanCardOrder(params: {
  planPayment: Record<string, unknown>;
  idempotencyKey: string;
  cardToken: string;
  paymentMethodId: string;
  installments: number;
  payerEmail: string;
}) {
  const { planPayment, idempotencyKey, cardToken, paymentMethodId, installments, payerEmail } = params;
  const amount = safeMoney(planPayment.amount);
  const hours = Number(planPayment.purchased_hours || 0);
  const description = `${planPayment.plan_name || "Plano Arena Gamer"} - ${hours} horas por ${planPayment.validity_days || 30} dias`.trim();

  const body = {
    type: "online",
    processing_mode: "automatic",
    external_reference: planPayment.id,
    description,
    total_amount: amount.toFixed(2),
    payer: {
      email: payerEmail,
      first_name: String(
        planPayment.customer_name || "Cliente NT"
      ).slice(0, 60),
    },
    transactions: {
      payments: [
        {
          amount: amount.toFixed(2),
          payment_method: {
            id: paymentMethodId,
            type: "credit_card",
            token: cardToken,
            installments,
          },
        },
      ],
    },
  };

  return mercadoPagoRequest("/v1/orders", {
    method: "POST",
    headers: mercadoPagoHeaders(idempotencyKey),
    body: JSON.stringify(body),
  });
}

export async function getOrder(orderId: string) {
  return mercadoPagoRequest(`/v1/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: mercadoPagoHeaders(),
  });
}

export async function hmacSha256Hex(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

function maskHash(value: string) {
  if (!value) return "";
  if (value.length <= 12) return "*".repeat(value.length);
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function parseMercadoPagoSignature(signatureHeader: string) {
  return signatureHeader.split(",").reduce((parsed, part) => {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey.trim();
    const value = rawValue.join("=").trim();
    if (key === "ts") parsed.timestamp = value;
    if (key === "v1") parsed.signature = value;
    return parsed;
  }, { timestamp: "", signature: "" });
}

function normalizeMercadoPagoDataId(dataId: string) {
  const cleanDataId = dataId.trim();
  return /[a-z]/i.test(cleanDataId) ? cleanDataId.toLowerCase() : cleanDataId;
}

export async function verifyMercadoPagoSignature(params: {
  signatureHeader: string;
  requestId: string;
  dataId: string;
}) {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") || "";
  if (!secret) throw new Error("MERCADO_PAGO_WEBHOOK_SECRET nao configurado.");

  const { timestamp, signature } = parseMercadoPagoSignature(params.signatureHeader);
  const received = signature.toLowerCase();
  const dataId = normalizeMercadoPagoDataId(params.dataId);
  if (!timestamp || !received || !params.requestId || !dataId) return false;

  const manifest = `id:${dataId};request-id:${params.requestId};ts:${timestamp};`;
  const expected = await hmacSha256Hex(secret, manifest);
  console.log("[Mercado Pago webhook] manifesto HMAC", {
    timestamp,
    requestId: params.requestId,
    receivedDataId: params.dataId,
    normalizedDataId: dataId,
    manifest,
    manifestLength: manifest.length,
    expectedMasked: maskHash(expected),
    receivedMasked: maskHash(received),
  });
  const signatureOk = constantTimeEqual(expected.toLowerCase(), received);
  if (!signatureOk) {
    console.log("[Mercado Pago webhook] diagnostico HMAC", {
      timestamp,
      receivedSignatureLength: received.length,
      manifestLength: manifest.length,
      expectedMasked: maskHash(expected),
      receivedMasked: maskHash(received),
      signatureOk,
    });
  }
  return signatureOk;
}
