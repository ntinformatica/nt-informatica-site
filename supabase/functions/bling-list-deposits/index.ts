import { BlingHttpError } from "../_shared/bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
} from "../_shared/blingConnection.ts";
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

function mapDeposit(item: unknown) {
  const deposit = isObject(item) ? item : {};
  return {
    id: cleanText(deposit.id),
    nome: cleanText(deposit.descricao || deposit.nome || deposit.name),
    situacao: deposit.situacao ?? null,
    padrao: deposit.padrao ?? null,
    desconsiderarSaldo: deposit.desconsiderarSaldo ?? null,
  };
}

function blingErrorMessage(error: BlingHttpError) {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para consultar depositos no Bling.";
  if (error.status === 404) return "Depositos nao encontrados no Bling.";
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel consultar depositos do Bling.";
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (!["GET", "POST"].includes(request.method)) return fail(request, "Metodo nao permitido.", 405);

    const token = bearerToken(request);
    if (!token) return fail(request, "Nao autenticado.", 401);

    const user = await getUserFromJwt(token);
    if (!user?.id) return fail(request, "Nao autenticado.", 401);

    const admin = await isAdminUser(user.id);
    if (!admin) return fail(request, "Acesso restrito a administradores.", 403);

    const connection = await loadActiveBlingConnection();
    const accessToken = await accessTokenForBlingConnection(connection);
    const context = { connection, accessToken };
    const response = await blingRequestWithTokenRefresh(context, "/depositos?pagina=1&limite=100", { method: "GET" });
    const rows = isObject(response) && Array.isArray(response.data) ? response.data : [];
    const metadata = isObject(connection.metadata) ? connection.metadata : {};

    return ok(request, {
      endpoint: "GET /depositos",
      configured_deposit: {
        id: cleanText(metadata.stockDepositId),
        nome: cleanText(metadata.stockDepositName),
      },
      count: rows.length,
      deposits: rows.map(mapDeposit),
    });
  } catch (error) {
    if (error instanceof BlingHttpError) {
      console.error("bling-list-deposits BlingHttpError", { status: error.status, temporary: error.temporary });
      return fail(request, blingErrorMessage(error), error.temporary ? 503 : error.status, {
        code: "bling_api_error",
        status: error.status,
      });
    }

    const message = error instanceof Error ? error.message : "Erro interno ao listar depositos Bling.";
    console.error("bling-list-deposits", { message });

    if (message === "bling_not_connected") return fail(request, "Bling nao conectado.", 409, { code: message });
    if (message === "bling_not_active") return fail(request, "Conexao Bling nao esta ativa.", 409, { code: message });
    if (message === "bling_access_token_missing") return fail(request, "Access token do Bling ausente.", 409, { code: message });

    return fail(request, "Erro interno ao listar depositos Bling.", 500);
  }
});
