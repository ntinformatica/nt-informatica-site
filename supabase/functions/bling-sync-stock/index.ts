import { BlingHttpError } from "../_shared/bling.ts";
import {
  stockSyncBlingErrorMessage,
  stockSyncValidationMessage,
  syncSingleProductStockToBling,
} from "../_shared/blingStockSync.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;
type SupabaseAuthUser = { id?: string; email?: string };

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

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value));
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

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text) return {};
  const payload = JSON.parse(text);
  return isObject(payload) ? payload : {};
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

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const token = bearerToken(request);
    if (!token) return fail(request, "Nao autenticado.", 401);

    const user = await getUserFromJwt(token);
    if (!user?.id) return fail(request, "Nao autenticado.", 401);

    const admin = await isAdminUser(user.id);
    if (!admin) return fail(request, "Acesso restrito a administradores.", 403);

    const body = await readJsonBody(request);
    const productId = cleanText(body.product_id);
    if (!isUuid(productId)) return fail(request, "Produto invalido.", 400, { code: "invalid_product_id" });

    const result = await syncSingleProductStockToBling(productId);
    return ok(request, result);
  } catch (error) {
    if (error instanceof BlingHttpError) {
      console.error("bling-sync-stock BlingHttpError", { status: error.status, temporary: error.temporary });
      return fail(request, stockSyncBlingErrorMessage(error), error.temporary ? 503 : error.status, {
        code: "bling_api_error",
        status: error.status,
      });
    }

    const message = error instanceof Error ? error.message : "Erro interno ao sincronizar estoque no Bling.";
    console.error("bling-sync-stock", { message });

    if (message === "bling_not_connected") return fail(request, "Bling nao conectado.", 409, { code: message });
    if (message === "bling_not_active") return fail(request, "Conexao Bling nao esta ativa.", 409, { code: message });
    if (message === "bling_access_token_missing") return fail(request, "Access token do Bling ausente.", 409, { code: message });
    if (message === "bling_refresh_token_missing") return fail(request, "Refresh token do Bling ausente.", 409, { code: message });
    if (message === "bling_refresh_in_progress") return fail(request, "Token do Bling esta sendo renovado. Tente novamente em instantes.", 409, { code: message });
    if (message === "bling_refresh_lock_lost") return fail(request, "Outra tentativa renovou a conexao Bling. Tente novamente.", 409, { code: message });

    const knownMessage = stockSyncValidationMessage(message);
    if (knownMessage !== stockSyncValidationMessage("unknown")) {
      return fail(request, knownMessage, message === "product_not_found" ? 404 : 422, { code: message });
    }

    return fail(request, "Erro interno ao sincronizar estoque no Bling.", 500);
  }
});
