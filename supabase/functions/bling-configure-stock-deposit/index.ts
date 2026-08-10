import { BlingHttpError } from "../_shared/bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
} from "../_shared/blingConnection.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest } from "../_shared/supabaseAdmin.ts";

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

function isPositiveIntegerText(value: unknown) {
  return /^\d+$/.test(cleanText(value));
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

function extractDeposit(response: unknown) {
  return isObject(response) && isObject(response.data) ? response.data : response;
}

function depositName(deposit: unknown) {
  const item = isObject(deposit) ? deposit : {};
  return cleanText(item.descricao || item.nome || item.name);
}

function blingErrorMessage(error: BlingHttpError) {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para consultar depositos no Bling.";
  if (error.status === 404) return "Deposito nao encontrado no Bling.";
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel configurar o deposito Bling.";
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
    const depositId = cleanText(body.deposit_id);
    if (!isPositiveIntegerText(depositId)) return fail(request, "Deposito Bling invalido.", 400, { code: "invalid_deposit_id" });

    const connection = await loadActiveBlingConnection();
    const accessToken = await accessTokenForBlingConnection(connection);
    const context = { connection, accessToken };
    const blingDeposit = extractDeposit(await blingRequestWithTokenRefresh(context, `/depositos/${depositId}`, { method: "GET" }));
    const name = depositName(blingDeposit) || cleanText(body.deposit_name) || `Deposito ${depositId}`;
    const currentMetadata = isObject(connection.metadata) ? connection.metadata : {};
    const metadata = {
      ...currentMetadata,
      stockDepositId: depositId,
      stockDepositName: name,
      stockDepositConfiguredAt: new Date().toISOString(),
      stockDepositConfiguredBy: user.id,
    };

    const rows = await supabaseRest("/bling_connections?connection_key=eq.nt-main&select=connection_key,metadata,updated_at", {
      method: "PATCH",
      body: JSON.stringify({
        metadata,
        updated_at: new Date().toISOString(),
      }),
    });

    const saved = Array.isArray(rows) ? rows[0] || null : null;
    if (!saved) throw new Error("bling_connection_update_failed");

    return ok(request, {
      configured_deposit: {
        id: depositId,
        nome: name,
      },
    });
  } catch (error) {
    if (error instanceof BlingHttpError) {
      console.error("bling-configure-stock-deposit BlingHttpError", { status: error.status, temporary: error.temporary });
      return fail(request, blingErrorMessage(error), error.temporary ? 503 : error.status, {
        code: "bling_api_error",
        status: error.status,
      });
    }

    const message = error instanceof Error ? error.message : "Erro interno ao configurar deposito Bling.";
    console.error("bling-configure-stock-deposit", { message });

    if (message === "bling_not_connected") return fail(request, "Bling nao conectado.", 409, { code: message });
    if (message === "bling_not_active") return fail(request, "Conexao Bling nao esta ativa.", 409, { code: message });
    if (message === "bling_access_token_missing") return fail(request, "Access token do Bling ausente.", 409, { code: message });
    if (message === "bling_connection_update_failed") return fail(request, "Nao foi possivel salvar o deposito Bling.", 500, { code: message });

    return fail(request, "Erro interno ao configurar deposito Bling.", 500);
  }
});
