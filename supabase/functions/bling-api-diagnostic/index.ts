import {
  BlingHttpError,
  blingRequest,
  decryptBlingToken,
} from "../_shared/bling.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type SupabaseAuthUser = {
  id?: string;
  email?: string;
};

type BlingConnection = {
  status?: string;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  access_token_expires_at?: string | null;
  token_type?: string | null;
  scopes?: string[] | null;
};

type DiagnosticRequest = {
  action?: string;
  order_id?: string | number;
  pagina?: string | number;
  limite?: string | number;
  dataInicial?: string;
  dataFinal?: string;
  numero?: string | number;
  idContato?: string | number;
};

const MAX_LIMIT = 20;

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

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readPayload(request: Request): Promise<DiagnosticRequest> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    return {
      action: url.searchParams.get("action") || undefined,
      order_id: url.searchParams.get("order_id") || undefined,
      pagina: url.searchParams.get("pagina") || undefined,
      limite: url.searchParams.get("limite") || undefined,
      dataInicial: url.searchParams.get("dataInicial") || undefined,
      dataFinal: url.searchParams.get("dataFinal") || undefined,
      numero: url.searchParams.get("numero") || undefined,
      idContato: url.searchParams.get("idContato") || undefined,
    };
  }

  const body = await request.text();
  if (!body) return {};
  const payload = JSON.parse(body);
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

async function getActiveConnection() {
  const connection = await getSingle(
    "/bling_connections?connection_key=eq.nt-main&select=status,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,token_type,scopes&limit=1",
  ) as BlingConnection | null;

  if (!connection) throw new Error("bling_not_connected");
  if (connection.status !== "active") throw new Error("bling_not_active");
  if (!connection.access_token_encrypted) throw new Error("bling_access_token_missing");

  return connection;
}

function positiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function safeIntegerText(value: unknown) {
  const clean = String(value || "").trim();
  return /^\d+$/.test(clean) ? clean : "";
}

function safeDateText(value: unknown) {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function listQuery(params: DiagnosticRequest) {
  const query = new URLSearchParams();
  query.set("pagina", String(positiveInteger(params.pagina, 1)));
  query.set("limite", String(positiveInteger(params.limite, MAX_LIMIT, MAX_LIMIT)));
  return query;
}

function ordersQuery(params: DiagnosticRequest) {
  const query = listQuery(params);
  const dataInicial = safeDateText(params.dataInicial);
  const dataFinal = safeDateText(params.dataFinal);
  const numero = safeIntegerText(params.numero);
  const idContato = safeIntegerText(params.idContato);

  if (dataInicial) query.set("dataInicial", dataInicial);
  if (dataFinal) query.set("dataFinal", dataFinal);
  if (numero) query.set("numero", numero);
  if (idContato) query.set("idContato", idContato);

  return query;
}

function extractRows(payload: unknown) {
  if (isObject(payload) && Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function asRecord(value: unknown) {
  return isObject(value) ? value : {};
}

function mapProduct(item: unknown) {
  const product = asRecord(item);
  return {
    id: product.id ?? null,
    codigo: product.codigo ?? product.sku ?? null,
    nome: product.nome ?? product.name ?? null,
    situacao: product.situacao ?? product.status ?? null,
    tipo: product.tipo ?? product.formato ?? null,
    preco: product.preco ?? product.price ?? null,
  };
}

function mapOrder(item: unknown) {
  const order = asRecord(item);
  const contato = asRecord(order.contato);
  return {
    id: order.id ?? null,
    numero: order.numero ?? order.numeroPedido ?? null,
    situacao: order.situacao ?? order.status ?? null,
    data: order.data ?? order.dataEmissao ?? order.dataPedido ?? null,
    total: order.total ?? order.valorTotal ?? null,
    contato: {
      id: contato.id ?? null,
      nome: contato.nome ?? contato.name ?? null,
    },
  };
}

function maskDocument(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function maskEmail(value: unknown) {
  const email = String(value || "").trim();
  if (!email.includes("@")) return email || null;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

function maskPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function sanitizeDetail(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDetail);
  if (!isObject(value)) return value;

  const sanitized: JsonObject = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("token") || normalizedKey === "authorization") continue;
    if (["numerodocumento", "documento", "cpf", "cnpj"].includes(normalizedKey)) {
      sanitized[key] = maskDocument(raw);
      continue;
    }
    if (["email", "emailnfe"].includes(normalizedKey)) {
      sanitized[key] = maskEmail(raw);
      continue;
    }
    if (normalizedKey.includes("fone") || normalizedKey.includes("telefone") || normalizedKey.includes("celular")) {
      sanitized[key] = maskPhone(raw);
      continue;
    }
    sanitized[key] = sanitizeDetail(raw);
  }
  return sanitized;
}

function isExpired(isoValue: string | null | undefined) {
  if (!isoValue) return false;
  const timestamp = new Date(isoValue).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 60_000;
}

function blingErrorMessage(error: BlingHttpError) {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para consultar este recurso no Bling.";
  if (error.status === 404) return "Registro nao encontrado no Bling.";
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel consultar a API do Bling.";
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (!["GET", "POST"].includes(request.method)) {
      return fail(request, "Metodo nao permitido.", 405);
    }

    const token = bearerToken(request);
    if (!token) return fail(request, "Nao autenticado.", 401);

    const user = await getUserFromJwt(token);
    if (!user?.id) return fail(request, "Nao autenticado.", 401);

    const admin = await isAdminUser(user.id);
    if (!admin) return fail(request, "Acesso restrito a administradores.", 403);

    const payload = await readPayload(request);
    const action = String(payload.action || "products").trim().toLowerCase();
    if (!["products", "orders", "order"].includes(action)) {
      return fail(request, "Acao de diagnostico invalida.", 400, {
        allowed_actions: ["products", "orders", "order"],
      });
    }

    const connection = await getActiveConnection();
    if (isExpired(connection.access_token_expires_at)) {
      return fail(request, "Token do Bling expirado. Reconecte ou renove a integracao.", 401, {
        code: "token_refresh_required",
      });
    }

    const accessToken = await decryptBlingToken(connection.access_token_encrypted || "");

    if (action === "products") {
      const query = listQuery(payload);
      const response = await blingRequest(accessToken, `/produtos?${query.toString()}`, { method: "GET" });
      const rows = extractRows(response);
      return ok(request, {
        action,
        endpoint: "GET /produtos",
        count: rows.length,
        items: rows.map(mapProduct),
      });
    }

    if (action === "orders") {
      const query = ordersQuery(payload);
      const response = await blingRequest(accessToken, `/pedidos/vendas?${query.toString()}`, { method: "GET" });
      const rows = extractRows(response);
      return ok(request, {
        action,
        endpoint: "GET /pedidos/vendas",
        count: rows.length,
        items: rows.map(mapOrder),
      });
    }

    const orderId = safeIntegerText(payload.order_id);
    if (!orderId) return fail(request, "ID do pedido Bling invalido.", 400);

    const response = await blingRequest(accessToken, `/pedidos/vendas/${orderId}`, { method: "GET" });
    return ok(request, {
      action,
      endpoint: "GET /pedidos/vendas/{idPedidoVenda}",
      order: sanitizeDetail(isObject(response) && "data" in response ? response.data : response),
    });
  } catch (error) {
    if (error instanceof BlingHttpError) {
      console.error("bling-api-diagnostic BlingHttpError", {
        status: error.status,
        temporary: error.temporary,
      });
      return fail(request, blingErrorMessage(error), error.temporary ? 503 : error.status, {
        code: error.status === 401 ? "token_refresh_required" : "bling_api_error",
        status: error.status,
      });
    }

    const message = error instanceof Error ? error.message : "Erro interno no diagnostico Bling.";
    console.error("bling-api-diagnostic", { message });

    if (message === "bling_not_connected") return fail(request, "Bling nao conectado.", 409);
    if (message === "bling_not_active") return fail(request, "Conexao Bling nao esta ativa.", 409);
    if (message === "bling_access_token_missing") return fail(request, "Access token do Bling ausente.", 409);

    return fail(request, "Erro interno no diagnostico Bling.", 500);
  }
});
