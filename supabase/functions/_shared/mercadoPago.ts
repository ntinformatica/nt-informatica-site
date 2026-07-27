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

async function mercadoPagoRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, options);
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
    throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload));
  }

  return payload as Record<string, unknown>;
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
    notification_url: webhookUrl || undefined,
    payer: {
      first_name: String(reservation.customer_name || "Cliente NT").slice(0, 60),
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

export async function verifyMercadoPagoSignature(params: {
  signatureHeader: string;
  requestId: string;
  dataId: string;
}) {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") || "";
  if (!secret) throw new Error("MERCADO_PAGO_WEBHOOK_SECRET nao configurado.");

  const parts = Object.fromEntries(
    params.signatureHeader.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );

  const timestamp = parts.ts || "";
  const received = parts.v1 || "";
  if (!timestamp || !received || !params.requestId || !params.dataId) return false;

  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${timestamp};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return expected === received;
}
