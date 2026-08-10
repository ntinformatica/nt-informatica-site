import { BlingHttpError } from "../_shared/bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
  type BlingAccessContext,
  type BlingConnection,
} from "../_shared/blingConnection.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;
type SupabaseAuthUser = { id?: string; email?: string };

type ProductRow = {
  id: string;
  name?: string | null;
  sku?: string | null;
  stock?: number | string | null;
  bling_product_id?: string | null;
  bling_stock_sync_status?: string | null;
  bling_stock_sync_metadata?: JsonObject | null;
};

type StockSyncResult = {
  success: boolean;
  product_id: string;
  bling_product_id: string;
  deposit_id: string;
  deposit_name: string;
  nt_stock: number;
  bling_stock_before: number;
  bling_stock_after: number;
  delta: number;
  operation: "E" | "S" | null;
  movement_created: boolean;
  product: JsonObject | null;
};

const PRODUCT_SELECT = [
  "id",
  "name",
  "sku",
  "stock",
  "bling_product_id",
  "bling_stock_synced_at",
  "bling_stock_sync_status",
  "bling_stock_sync_error",
  "bling_stock_sync_metadata",
].join(",");

const STOCK_SYNC_STALE_MS = 10 * 60 * 1000;

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

function finiteStock(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 1000) / 1000 : null;
}

function nowIso() {
  return new Date().toISOString();
}

function isStaleSyncMetadata(metadata: unknown) {
  if (!isObject(metadata)) return false;
  const startedAt = cleanText(metadata.syncStartedAt);
  if (!startedAt) return false;
  const timestamp = new Date(startedAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now() - STOCK_SYNC_STALE_MS;
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

async function loadProduct(productId: string) {
  return await getSingle(
    `/products?id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(PRODUCT_SELECT)}&limit=1`,
  ) as ProductRow | null;
}

function stockDepositFromConnection(connection: BlingConnection) {
  const metadata = isObject(connection.metadata) ? connection.metadata : {};
  return {
    id: cleanText(metadata.stockDepositId),
    name: cleanText(metadata.stockDepositName),
  };
}

function extractRows(payload: unknown) {
  if (isObject(payload) && Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function objectNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPhysicalBalance(payload: unknown, blingProductId: string, depositId: string) {
  const rows = extractRows(payload);
  for (const row of rows) {
    const item = isObject(row) ? row : {};
    const product = isObject(item.produto) ? item.produto : {};
    if (cleanText(product.id) && cleanText(product.id) !== blingProductId) continue;

    const deposits = Array.isArray(item.depositos) ? item.depositos : [];
    for (const rawDeposit of deposits) {
      const deposit = isObject(rawDeposit) ? rawDeposit : {};
      if (cleanText(deposit.id) === depositId) {
        return objectNumber(deposit.saldoFisico) ?? 0;
      }
    }

    return objectNumber(item.saldoFisico) ?? objectNumber(item.saldoFisicoTotal) ?? 0;
  }
  return null;
}

function sanitizeBlingResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeBlingResponse);
  if (!isObject(value)) return value;

  const sanitized: JsonObject = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (normalized.includes("token") || normalized === "authorization") continue;
    sanitized[key] = sanitizeBlingResponse(raw);
  }
  return sanitized;
}

async function loadBlingStock(context: BlingAccessContext, blingProductId: string, depositId: string) {
  const query = new URLSearchParams();
  query.append("idsProdutos[]", blingProductId);
  const response = await blingRequestWithTokenRefresh(
    context,
    `/estoques/saldos/${depositId}?${query.toString()}`,
    { method: "GET" },
  );
  const physicalBalance = extractPhysicalBalance(response, blingProductId, depositId);
  if (physicalBalance === null) throw new Error("bling_stock_balance_not_found");
  return {
    physicalBalance,
    raw: response,
  };
}

async function createBlingStockMovement(
  context: BlingAccessContext,
  params: {
    blingProductId: string;
    depositId: string;
    operation: "E" | "S";
    quantity: number;
    productName: string;
  },
) {
  return await blingRequestWithTokenRefresh(context, "/estoques", {
    method: "POST",
    body: {
      deposito: {
        id: Number(params.depositId),
      },
      operacao: params.operation,
      produto: {
        id: Number(params.blingProductId),
      },
      quantidade: params.quantity,
      observacoes: `Sincronizacao NT Admin - ${params.productName}`.slice(0, 255),
    },
  });
}

async function markStockSyncing(productId: string, syncAttemptId: string) {
  const rows = await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_stock_sync_status=in.(not_synced,synced,error)"
    + "&select=id,bling_stock_sync_status,bling_stock_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_stock_sync_status: "syncing",
        bling_stock_sync_error: "",
        bling_stock_sync_metadata: {
          syncAttemptId,
          syncStartedAt: nowIso(),
        },
      }),
    },
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function recoverStaleStockSyncing(productId: string, syncAttemptId: string) {
  const current = await loadProduct(productId);
  if (!current || current.bling_stock_sync_status !== "syncing") return false;
  if (!isStaleSyncMetadata(current.bling_stock_sync_metadata)) return false;

  const previousMetadata = isObject(current.bling_stock_sync_metadata) ? current.bling_stock_sync_metadata : {};
  const previousAttemptId = cleanText(previousMetadata.syncAttemptId);
  const previousStartedAt = cleanText(previousMetadata.syncStartedAt);
  let filters = `/products?id=eq.${encodeURIComponent(productId)}&bling_stock_sync_status=eq.syncing`;
  filters += previousAttemptId
    ? `&bling_stock_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(previousAttemptId)}`
    : "&bling_stock_sync_metadata->>syncAttemptId=is.null";
  filters += `&bling_stock_sync_metadata->>syncStartedAt=eq.${encodeURIComponent(previousStartedAt)}`;

  const startedAt = nowIso();
  const rows = await supabaseRest(
    filters + "&select=id,bling_stock_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_stock_sync_status: "syncing",
        bling_stock_sync_error: "",
        bling_stock_sync_metadata: {
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

async function saveStockSyncSuccess(
  productId: string,
  syncAttemptId: string,
  metadata: JsonObject,
) {
  const syncedAt = nowIso();
  const rows = await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_stock_sync_status=eq.syncing"
    + `&bling_stock_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(syncAttemptId)}`
    + "&select=id,bling_stock_synced_at,bling_stock_sync_status,bling_stock_sync_error,bling_stock_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_stock_synced_at: syncedAt,
        bling_stock_sync_status: "synced",
        bling_stock_sync_error: "",
        bling_stock_sync_metadata: {
          ...metadata,
          syncedAt,
          syncAttemptId,
        },
      }),
    },
  );

  const updatedProduct = Array.isArray(rows) ? rows[0] || null : null;
  if (!updatedProduct) throw new Error("bling_stock_sync_lock_lost");
  return updatedProduct as JsonObject;
}

async function markStockSyncError(productId: string, syncAttemptId: string, errorCode: string, message: string) {
  await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_stock_sync_status=eq.syncing"
    + `&bling_stock_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(syncAttemptId)}`
    + "&select=id",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_stock_sync_status: "error",
        bling_stock_sync_error: message,
        bling_stock_sync_metadata: {
          syncAttemptId,
          errorCode,
          failedAt: nowIso(),
        },
      }),
    },
  ).catch(() => null);
}

function blingErrorMessage(error: BlingHttpError) {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para sincronizar estoque no Bling.";
  if (error.status === 404) return "Produto ou deposito nao encontrado no Bling.";
  if (error.status === 422) return "O Bling recusou a movimentacao de estoque.";
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel sincronizar estoque no Bling.";
}

function validationMessage(code: string) {
  const messages: Record<string, string> = {
    product_not_found: "Produto nao encontrado.",
    product_not_linked_to_bling: "Produto ainda nao esta vinculado ao Bling.",
    invalid_nt_stock: "Estoque NT invalido para sincronizacao.",
    stock_deposit_not_configured: "Configure o deposito principal do Bling antes de sincronizar estoque.",
    bling_stock_balance_not_found: "Nao foi possivel localizar o saldo do produto no deposito Bling configurado.",
    bling_stock_sync_in_progress: "Estoque deste produto ja esta sendo sincronizado. Aguarde a conclusao.",
    bling_stock_sync_lock_lost: "Outra tentativa alterou a sincronizacao de estoque. Atualize e tente novamente.",
  };
  return messages[code] || "Nao foi possivel sincronizar estoque no Bling.";
}

export async function syncSingleProductStockToBling(productId: string): Promise<StockSyncResult> {
  const product = await loadProduct(productId);
  if (!product) throw new Error("product_not_found");

  const ntStock = finiteStock(product.stock);
  const blingProductId = cleanText(product.bling_product_id);
  if (!blingProductId) throw new Error("product_not_linked_to_bling");
  if (ntStock === null) throw new Error("invalid_nt_stock");

  const syncAttemptId = crypto.randomUUID();
  let ownsSyncAttempt = await markStockSyncing(product.id, syncAttemptId);
  if (!ownsSyncAttempt) {
    const current = await loadProduct(product.id);
    if (current?.bling_stock_sync_status === "syncing" && isStaleSyncMetadata(current.bling_stock_sync_metadata)) {
      ownsSyncAttempt = await recoverStaleStockSyncing(product.id, syncAttemptId);
    }
    if (!ownsSyncAttempt) throw new Error("bling_stock_sync_in_progress");
  }

  try {
    const connection = await loadActiveBlingConnection();
    const deposit = stockDepositFromConnection(connection);
    if (!deposit.id) throw new Error("stock_deposit_not_configured");

    const accessToken = await accessTokenForBlingConnection(connection);
    const context = { connection, accessToken };
    const balance = await loadBlingStock(context, blingProductId, deposit.id);
    const blingStockBefore = Math.round(balance.physicalBalance * 1000) / 1000;
    const delta = Math.round((ntStock - blingStockBefore) * 1000) / 1000;
    const operation = delta > 0 ? "E" : delta < 0 ? "S" : null;
    const quantity = Math.abs(delta);
    let movementResponse: unknown = null;

    if (operation && quantity > 0) {
      movementResponse = await createBlingStockMovement(context, {
        blingProductId,
        depositId: deposit.id,
        operation,
        quantity,
        productName: cleanText(product.name) || blingProductId,
      });
    }

    const updatedProduct = await saveStockSyncSuccess(product.id, syncAttemptId, {
      depositId: deposit.id,
      depositName: deposit.name,
      ntStock,
      blingStockBefore,
      blingStockAfter: ntStock,
      delta,
      operation,
      movementCreated: Boolean(operation),
      balanceResponse: sanitizeBlingResponse(balance.raw),
      movementResponse: sanitizeBlingResponse(movementResponse),
    });

    return {
      success: true,
      product_id: product.id,
      bling_product_id: blingProductId,
      deposit_id: deposit.id,
      deposit_name: deposit.name,
      nt_stock: ntStock,
      bling_stock_before: blingStockBefore,
      bling_stock_after: ntStock,
      delta,
      operation,
      movement_created: Boolean(operation),
      product: updatedProduct,
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    const message = error instanceof BlingHttpError ? blingErrorMessage(error) : validationMessage(code);
    await markStockSyncError(product.id, syncAttemptId, error instanceof BlingHttpError ? "bling_api_error" : code, message);
    throw error;
  }
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
      return fail(request, blingErrorMessage(error), error.temporary ? 503 : error.status, {
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

    const knownMessage = validationMessage(message);
    if (knownMessage !== validationMessage("unknown")) {
      return fail(request, knownMessage, message === "product_not_found" ? 404 : 422, { code: message });
    }

    return fail(request, "Erro interno ao sincronizar estoque no Bling.", 500);
  }
});
