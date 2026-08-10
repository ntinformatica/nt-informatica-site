export const BLING_AUTHORIZATION_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
export const BLING_TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";
export const BLING_API_BASE_URL = "https://api.bling.com.br/Api/v3";

const TOKEN_EXPIRATION_SAFETY_SECONDS = 60;
const BLING_REQUEST_TIMEOUT_MS = 15000;
const AES_GCM_IV_BYTES = 12;
const STATE_BYTES = 32;
const ENCRYPTED_TOKEN_VERSION = "v1";

type JsonObject = Record<string, unknown>;
type BlingConfigEnvName =
  | "BLING_CLIENT_ID"
  | "BLING_CLIENT_SECRET"
  | "BLING_REDIRECT_URI"
  | "BLING_TOKEN_ENCRYPTION_KEY";

export type BlingConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
};

export type BlingTokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scopes: string[];
  expiresIn: number | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  raw: JsonObject;
};

export type BlingConnection = {
  id: string;
  status: "active" | "reauthorization_required" | "revoked" | "error";
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_type: string;
  scopes: string[];
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
};

export type BlingRequestOptions = Omit<RequestInit, "headers" | "body"> & {
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class BlingHttpError extends Error {
  status: number;
  payload: unknown;
  temporary: boolean;

  constructor(status: number, payload: unknown) {
    super(typeof payload === "string" ? payload : JSON.stringify(payload));
    this.name = "BlingHttpError";
    this.status = status;
    this.payload = payload;
    this.temporary = status === 429 || status >= 500;
  }
}

const REQUIRED_BLING_SECRETS: BlingConfigEnvName[] = [
  "BLING_CLIENT_ID",
  "BLING_CLIENT_SECRET",
  "BLING_REDIRECT_URI",
  "BLING_TOKEN_ENCRYPTION_KEY",
];

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function firstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function base64UrlEncode(bytes: Uint8Array) {
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64Encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function fromUtf8(bytes: ArrayBuffer) {
  return new TextDecoder().decode(bytes);
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = utf8(left);
  const rightBytes = utf8(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return diff === 0;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", utf8(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function aesKeyFromSecret(secret: string) {
  if (!secret || secret.length < 32) {
    throw new Error("BLING_TOKEN_ENCRYPTION_KEY deve ter pelo menos 32 caracteres.");
  }

  const digest = await crypto.subtle.digest("SHA-256", utf8(secret));
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function parseJsonText(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function scopesFromPayload(payload: JsonObject) {
  const scope = firstString([payload.scope, payload.scopes]);
  if (scope) return scope.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  const scopes = payload.scopes;
  return Array.isArray(scopes) ? scopes.map((item) => cleanText(item)).filter(Boolean) : [];
}

function expirationFromSeconds(seconds: number | null) {
  if (!seconds || seconds <= 0) return null;
  const safeSeconds = Math.max(1, seconds - TOKEN_EXPIRATION_SAFETY_SECONDS);
  return new Date(Date.now() + safeSeconds * 1000).toISOString();
}

function refreshExpirationFromPayload(payload: JsonObject) {
  const raw = Number(
    payload.refresh_expires_in
    || payload.refresh_token_expires_in
    || payload.refreshTokenExpiresIn
    || 0,
  );
  return Number.isFinite(raw) && raw > 0 ? expirationFromSeconds(raw) : null;
}

function normalizeTokenResponse(payload: unknown): BlingTokenResponse {
  if (!isObject(payload)) throw new Error("Resposta de token Bling invalida.");

  const accessToken = firstString([payload.access_token, payload.accessToken]);
  const refreshToken = firstString([payload.refresh_token, payload.refreshToken]);
  if (!accessToken) throw new Error("Resposta Bling sem access_token.");
  if (!refreshToken) throw new Error("Resposta Bling sem refresh_token.");

  const expiresInValue = Number(payload.expires_in || payload.expiresIn || 0);
  const expiresIn = Number.isFinite(expiresInValue) && expiresInValue > 0 ? expiresInValue : null;

  return {
    accessToken,
    refreshToken,
    tokenType: firstString([payload.token_type, payload.tokenType]) || "Bearer",
    scopes: scopesFromPayload(payload),
    expiresIn,
    accessTokenExpiresAt: expirationFromSeconds(expiresIn),
    refreshTokenExpiresAt: refreshExpirationFromPayload(payload),
    raw: payload,
  };
}

async function tokenRequest(params: URLSearchParams) {
  const config = getBlingConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BLING_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BLING_TOKEN_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: blingBasicAuthHeader(config),
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const payload = parseJsonText(await response.text());

    if (!response.ok) {
      throw new BlingHttpError(response.status, payload);
    }

    return normalizeTokenResponse(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BlingHttpError(504, { message: "Timeout ao chamar token OAuth do Bling." });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getBlingConfig(): BlingConfig {
  validateBlingConfig();
  return {
    clientId: String(Deno.env.get("BLING_CLIENT_ID") || ""),
    clientSecret: String(Deno.env.get("BLING_CLIENT_SECRET") || ""),
    redirectUri: String(Deno.env.get("BLING_REDIRECT_URI") || ""),
    tokenEncryptionKey: String(Deno.env.get("BLING_TOKEN_ENCRYPTION_KEY") || ""),
  };
}

export function validateBlingConfig() {
  const missing = REQUIRED_BLING_SECRETS.filter((name) => !cleanText(Deno.env.get(name)));
  if (missing.length) {
    throw new Error(`Secrets Bling ausentes: ${missing.join(", ")}.`);
  }
}

export function buildBlingAuthorizationUrl(params: {
  state: string;
  scopes?: string[];
}) {
  const config = getBlingConfig();
  const url = new URL(BLING_AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", params.state);
  if (params.scopes?.length) url.searchParams.set("scope", params.scopes.join(" "));
  return url.toString();
}

export function generateBlingOAuthState() {
  return base64UrlEncode(randomBytes(STATE_BYTES));
}

export async function hashBlingOAuthState(state: string) {
  const cleanState = cleanText(state);
  if (!cleanState) throw new Error("State OAuth ausente.");
  return sha256Hex(cleanState);
}

export async function timingSafeCompareBlingStateHash(state: string, expectedHash: string) {
  const actualHash = await hashBlingOAuthState(state);
  return constantTimeEqual(actualHash, cleanText(expectedHash).toLowerCase());
}

export function blingBasicAuthHeader(config = getBlingConfig()) {
  const credentials = utf8(`${config.clientId}:${config.clientSecret}`);
  return `Basic ${base64Encode(credentials)}`;
}

export async function exchangeBlingAuthorizationCode(code: string) {
  const config = getBlingConfig();
  const cleanCode = cleanText(code);
  if (!cleanCode) throw new Error("Codigo OAuth do Bling ausente.");

  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", cleanCode);
  params.set("redirect_uri", config.redirectUri);
  return tokenRequest(params);
}

export async function refreshBlingAccessToken(refreshToken: string) {
  const cleanRefreshToken = cleanText(refreshToken);
  if (!cleanRefreshToken) throw new Error("Refresh token do Bling ausente.");

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", cleanRefreshToken);
  return tokenRequest(params);
}

export async function encryptBlingToken(token: string) {
  const config = getBlingConfig();
  const cleanToken = cleanText(token);
  if (!cleanToken) throw new Error("Token Bling ausente para criptografia.");

  const iv = randomBytes(AES_GCM_IV_BYTES);
  const key = await aesKeyFromSecret(config.tokenEncryptionKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    utf8(cleanToken),
  );

  return [
    ENCRYPTED_TOKEN_VERSION,
    base64UrlEncode(iv),
    base64UrlEncode(new Uint8Array(ciphertext)),
  ].join(":");
}

export async function decryptBlingToken(payload: string) {
  const config = getBlingConfig();
  const [version, ivEncoded, ciphertextEncoded] = cleanText(payload).split(":");
  if (version !== ENCRYPTED_TOKEN_VERSION || !ivEncoded || !ciphertextEncoded) {
    throw new Error("Payload criptografado do Bling invalido.");
  }

  const key = await aesKeyFromSecret(config.tokenEncryptionKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(ivEncoded) },
    key,
    base64UrlDecode(ciphertextEncoded),
  );

  return fromUtf8(plaintext);
}

export async function blingRequest<T = unknown>(
  accessToken: string,
  path: string,
  options: BlingRequestOptions = {},
): Promise<T> {
  const cleanAccessToken = cleanText(accessToken);
  if (!cleanAccessToken) throw new Error("Access token do Bling ausente.");

  const url = path.startsWith("http")
    ? path
    : `${BLING_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || BLING_REQUEST_TIMEOUT_MS);
  const hasBody = options.body !== undefined && options.body !== null;

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        Authorization: `Bearer ${cleanAccessToken}`,
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      body: hasBody
        ? typeof options.body === "string" ? options.body : JSON.stringify(options.body)
        : undefined,
    });
    const payload = parseJsonText(await response.text());

    if (!response.ok) {
      throw new BlingHttpError(response.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BlingHttpError(504, { message: "Timeout ao chamar Bling." });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
