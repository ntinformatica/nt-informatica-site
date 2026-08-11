import { BlingHttpError } from "./bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
  type BlingAccessContext,
  type BlingConnection,
} from "./blingConnection.ts";
import { getSingle, supabaseRest } from "./supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type ProductRow = {
  id: string;
  name?: string | null;
  sku?: string | null;
  stock?: number | string | null;
  bling_product_id?: string | null;
  bling_stock_sync_status?: string | null;
  bling_stock_sync_metadata?: JsonObject | null;
};

export type StockSyncResult = {
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

export const STOCK_PRODUCT_SELECT = [
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

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cleanText(value: unknown) {
  return String(value || "").trim();
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

async function loadProduct(productId: string) {
  return await getSingle(
    `/products?id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(STOCK_PRODUCT_SELECT)}&limit=1`,
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
    + "&bling_stock_sync_status=in.(not_synced,synced,error,dirty)"
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

export function stockSyncBlingErrorMessage(error: BlingHttpError) {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para sincronizar estoque no Bling.";
  if (error.status === 404) return "Produto ou deposito nao encontrado no Bling.";
  if (error.status === 422) return "O Bling recusou a movimentacao de estoque.";
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel sincronizar estoque no Bling.";
}

export function stockSyncValidationMessage(code: string) {
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

export function isRetryableStockSyncError(error: unknown) {
  if (error instanceof BlingHttpError) return error.temporary || error.status === 401;
  const message = error instanceof Error ? error.message : "";
  return ["bling_stock_sync_in_progress", "bling_refresh_in_progress", "bling_refresh_lock_lost"].includes(message);
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
    const message = error instanceof BlingHttpError ? stockSyncBlingErrorMessage(error) : stockSyncValidationMessage(code);
    await markStockSyncError(product.id, syncAttemptId, error instanceof BlingHttpError ? "bling_api_error" : code, message);
    throw error;
  }
}
