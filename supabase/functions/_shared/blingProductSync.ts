import { BlingHttpError } from "./bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
  type BlingAccessContext,
} from "./blingConnection.ts";
import { getSingle, supabaseRest } from "./supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  category_id?: string | null;
  brand?: string | null;
  model?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  price?: number | string | null;
  promo_price?: number | string | null;
  status?: string | null;
  stock?: number | string | null;
  sku?: string | null;
  warranty?: string | null;
  main_image?: string | null;
  images?: string[] | null;
  internal_notes?: string | null;
  bling_product_id?: string | null;
  bling_synced_at?: string | null;
  bling_sync_status?: string | null;
  bling_sync_error?: string | null;
  bling_sync_metadata?: JsonObject | null;
};

type VariationRow = {
  id: string;
  product_id: string;
  name?: string | null;
  value?: string | null;
  color?: string | null;
  price?: number | string | null;
  promo_price?: number | string | null;
  stock?: number | string | null;
  sku?: string | null;
  active?: boolean | null;
  status?: string | null;
};

type CategoryRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  active?: boolean | null;
};

export type SyncProductResult = {
  success: boolean;
  already_linked: boolean;
  linked_existing: boolean;
  updated_existing?: boolean;
  bling_product_id: string | null;
  product: JsonObject | null;
};

export const PRODUCT_SELECT = [
  "id",
  "name",
  "slug",
  "category_id",
  "brand",
  "model",
  "short_description",
  "full_description",
  "price",
  "promo_price",
  "status",
  "stock",
  "sku",
  "warranty",
  "main_image",
  "images",
  "internal_notes",
  "bling_product_id",
  "bling_synced_at",
  "bling_sync_status",
  "bling_sync_error",
  "bling_sync_metadata",
].join(",");

const PRODUCT_SYNC_STALE_MS = 10 * 60 * 1000;
const UNSUPPORTED_PRODUCT_SYNC_CODES = new Set([
  "draft_product",
  "product_variations_not_supported",
]);

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cleanText(value: unknown) {
  return String(value || "").trim();
}

function money(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function nowIso() {
  return new Date().toISOString();
}

function statusKey(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isStaleSyncMetadata(metadata: unknown) {
  if (!isObject(metadata)) return false;
  const startedAt = cleanText(metadata.syncStartedAt);
  if (!startedAt) return false;
  const timestamp = new Date(startedAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now() - PRODUCT_SYNC_STALE_MS;
}

async function loadProduct(productId: string) {
  return await getSingle(
    `/products?id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(PRODUCT_SELECT)}&limit=1`,
  ) as ProductRow | null;
}

async function loadProductVariations(productId: string) {
  const rows = await supabaseRest(
    `/product_variations?product_id=eq.${encodeURIComponent(productId)}&select=*&order=created_at.asc`,
  );
  return Array.isArray(rows) ? rows as VariationRow[] : [];
}

async function loadCategory(categoryId: string | null | undefined) {
  if (!categoryId) return null;
  return await getSingle(
    `/categories?id=eq.${encodeURIComponent(categoryId)}&select=id,name,slug,active&limit=1`,
  ) as CategoryRow | null;
}

function validateProduct(product: ProductRow, variations: VariationRow[], category: CategoryRow | null) {
  const sku = cleanText(product.sku);
  const name = cleanText(product.name);
  const price = money(product.price);
  const status = statusKey(product.status);

  if (!product.id) throw new Error("invalid_product");
  if (!sku) throw new Error("missing_product_sku");
  if (!/^[A-Za-z0-9._-]+$/.test(sku)) throw new Error("invalid_product_sku");
  if (!name) throw new Error("missing_product_name");
  if (price === null || price <= 0) throw new Error("invalid_product_price");
  if (status === "rascunho") throw new Error("draft_product");
  if (!["disponivel", "esgotado", "sob encomenda"].includes(status)) throw new Error("invalid_product_status");
  if (product.category_id && !category) throw new Error("invalid_product_category");
  if (category && category.active === false) throw new Error("inactive_product_category");
  if (variations.length) throw new Error("product_variations_not_supported");
}

export function productSyncValidationMessage(code: string) {
  const messages: Record<string, string> = {
    invalid_product: "Produto invalido para envio ao Bling.",
    missing_product_sku: "Produto sem SKU para localizar ou criar no Bling.",
    invalid_product_sku: "SKU do produto possui caracteres incompativeis com a sincronizacao.",
    missing_product_name: "Produto sem nome para enviar ao Bling.",
    invalid_product_price: "Produto sem preco valido para enviar ao Bling.",
    draft_product: "Produto em rascunho nao sera enviado ao Bling.",
    invalid_product_status: "Status do produto nao e compativel com sincronizacao.",
    invalid_product_category: "Categoria do produto nao foi encontrada.",
    inactive_product_category: "Categoria do produto esta inativa.",
    product_variations_not_supported: "Produto com variacoes ainda nao e sincronizado nesta etapa. Sincronize um produto simples primeiro.",
    linked_product_review_required: "Produto vinculado precisa de revisao administrativa antes de sincronizar.",
    linked_bling_product_not_found: "Produto vinculado nao foi encontrado no Bling. Revisao administrativa necessaria.",
    missing_bling_product_id: "O Bling retornou uma resposta sem ID de produto.",
    ambiguous_bling_product_sku: "Mais de um produto foi encontrado no Bling com o mesmo SKU. Resolva a duplicidade antes de vincular.",
    bling_sync_lock_lost: "Outra tentativa alterou a sincronizacao do produto. Atualize e tente novamente.",
  };
  return messages[code] || "Produto nao esta completo para envio ao Bling.";
}

export function isUnsupportedProductSyncCode(code: string) {
  return UNSUPPORTED_PRODUCT_SYNC_CODES.has(code);
}

function blingSituation(product: ProductRow) {
  return statusKey(product.status) === "esgotado" ? "I" : "A";
}

function buildBlingProductPayload(product: ProductRow) {
  const fullDescription = cleanText(product.full_description);
  const shortDescription = cleanText(product.short_description);
  const metadata = [
    cleanText(product.brand) ? `Marca: ${cleanText(product.brand)}` : "",
    cleanText(product.model) ? `Modelo: ${cleanText(product.model)}` : "",
    cleanText(product.warranty) ? `Garantia: ${cleanText(product.warranty)}` : "",
  ].filter(Boolean);

  return {
    nome: cleanText(product.name).slice(0, 120),
    codigo: cleanText(product.sku),
    preco: money(product.price),
    tipo: "P",
    formato: "S",
    situacao: blingSituation(product),
    unidade: "UN",
    descricaoCurta: shortDescription || fullDescription.slice(0, 255),
    descricaoComplementar: [fullDescription, ...metadata].filter(Boolean).join("\n\n"),
  };
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

function extractBlingProductId(response: unknown) {
  const data = isObject(response) && isObject(response.data) ? response.data : response;
  return isObject(data) ? cleanText(data.id) : "";
}

async function findBlingProductsByCode(context: BlingAccessContext, sku: string) {
  const query = new URLSearchParams();
  query.set("pagina", "1");
  query.set("limite", "20");
  query.set("codigo", sku);
  const response = await blingRequestWithTokenRefresh(context, `/produtos?${query.toString()}`, { method: "GET" });
  const rows = isObject(response) && Array.isArray(response.data) ? response.data : [];
  return rows.filter((item) => {
    const product = isObject(item) ? item : {};
    return cleanText(product.codigo).toLowerCase() === sku.toLowerCase();
  });
}

async function markSyncing(productId: string, syncAttemptId: string) {
  const rows = await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_sync_status=in.(not_sent,dirty,error,review_required)"
    + "&select=id,bling_sync_status,bling_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "syncing",
        bling_sync_error: "",
        bling_sync_metadata: {
          syncAttemptId,
          syncStartedAt: nowIso(),
        },
      }),
    },
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function markPreflightError(productId: string, errorCode: string, message: string, existingMetadata: unknown = null) {
  const unsupported = isUnsupportedProductSyncCode(errorCode);
  const previousMetadata = isObject(existingMetadata) ? existingMetadata : {};
  const skippedAt = nowIso();
  await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_product_id=is.null"
    + "&bling_sync_status=in.(not_sent,dirty,error,review_required)"
    + "&select=id",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: unsupported ? "unsupported" : "error",
        bling_sync_error: unsupported ? "" : message,
        bling_sync_metadata: {
          ...previousMetadata,
          errorCode,
          skippedReason: unsupported ? errorCode : undefined,
          skippedAt: unsupported ? skippedAt : undefined,
          failedAt: unsupported ? undefined : skippedAt,
        },
      }),
    },
  ).catch(() => null);
}

async function markProductReviewRequired(productId: string, errorCode: string, message: string, metadata: JsonObject = {}) {
  await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_sync_status=eq.syncing"
    + "&select=id",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "review_required",
        bling_sync_error: message,
        bling_sync_metadata: {
          errorCode,
          reviewRequiredAt: nowIso(),
          ...metadata,
        },
      }),
    },
  ).catch(() => null);
}

async function markSyncError(productId: string, syncAttemptId: string, errorCode: string, message: string) {
  await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_product_id=is.null"
    + "&bling_sync_status=eq.syncing"
    + `&bling_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(syncAttemptId)}`
    + "&select=id",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "error",
        bling_sync_error: message,
        bling_sync_metadata: {
          syncAttemptId,
          errorCode,
          failedAt: nowIso(),
        },
      }),
    },
  ).catch(() => null);
}

async function recoverStaleSyncing(productId: string, syncAttemptId: string) {
  const current = await loadProduct(productId);
  if (!current || current.bling_product_id || current.bling_sync_status !== "syncing") return false;
  if (!isStaleSyncMetadata(current.bling_sync_metadata)) return false;

  const previousMetadata = isObject(current.bling_sync_metadata) ? current.bling_sync_metadata : {};
  const previousAttemptId = cleanText(previousMetadata.syncAttemptId);
  const previousStartedAt = cleanText(previousMetadata.syncStartedAt);
  let filters = `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_product_id=is.null"
    + "&bling_sync_status=eq.syncing";
  filters += previousAttemptId
    ? `&bling_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(previousAttemptId)}`
    : "&bling_sync_metadata->>syncAttemptId=is.null";
  filters += `&bling_sync_metadata->>syncStartedAt=eq.${encodeURIComponent(previousStartedAt)}`;

  const startedAt = nowIso();
  const rows = await supabaseRest(
    filters + "&select=id,bling_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "syncing",
        bling_sync_error: "",
        bling_sync_metadata: {
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

async function saveBlingProductLink(productId: string, response: unknown, syncAttemptId: string) {
  const blingProductId = extractBlingProductId(response);
  if (!blingProductId) throw new Error("missing_bling_product_id");

  const syncedAt = nowIso();
  const rows = await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_product_id=is.null"
    + "&bling_sync_status=eq.syncing"
    + `&bling_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(syncAttemptId)}`
    + "&select=id,bling_product_id,bling_synced_at,bling_sync_status,bling_sync_error,bling_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_product_id: blingProductId,
        bling_synced_at: syncedAt,
        bling_sync_status: "synced",
        bling_sync_error: "",
        bling_sync_metadata: {
          syncedAt,
          syncAttemptId,
          response: sanitizeBlingResponse(response),
        },
      }),
    },
  );

  const updatedProduct = Array.isArray(rows) ? rows[0] || null : null;
  if (!updatedProduct) throw new Error("bling_sync_lock_lost");
  return updatedProduct as JsonObject;
}

async function saveBlingProductUpdate(productId: string, blingProductId: string, response: unknown, syncAttemptId: string) {
  const syncedAt = nowIso();
  const rows = await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + `&bling_product_id=eq.${encodeURIComponent(blingProductId)}`
    + "&bling_sync_status=eq.syncing"
    + `&bling_sync_metadata->>syncAttemptId=eq.${encodeURIComponent(syncAttemptId)}`
    + "&select=id,bling_product_id,bling_synced_at,bling_sync_status,bling_sync_error,bling_sync_metadata",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_synced_at: syncedAt,
        bling_sync_status: "synced",
        bling_sync_error: "",
        bling_sync_metadata: {
          syncedAt,
          syncAttemptId,
          operation: "updated_existing",
          response: sanitizeBlingResponse(response),
        },
      }),
    },
  );

  const updatedProduct = Array.isArray(rows) ? rows[0] || null : null;
  if (!updatedProduct) throw new Error("bling_sync_lock_lost");
  return updatedProduct as JsonObject;
}

async function loadBlingProduct(context: BlingAccessContext, blingProductId: string) {
  return await blingRequestWithTokenRefresh(context, `/produtos/${encodeURIComponent(blingProductId)}`, { method: "GET" });
}

function productDataFromResponse(response: unknown) {
  if (isObject(response) && isObject(response.data)) return response.data;
  return isObject(response) ? response : {};
}

function buildBlingProductUpdatePayload(remoteProductResponse: unknown, product: ProductRow) {
  const remoteProduct = productDataFromResponse(remoteProductResponse);
  return {
    ...remoteProduct,
    ...buildBlingProductPayload(product),
    id: Number(cleanText(product.bling_product_id)) || remoteProduct.id,
  };
}

async function updateLinkedBlingProduct(context: BlingAccessContext, product: ProductRow) {
  const blingProductId = cleanText(product.bling_product_id);
  const remoteProduct = await loadBlingProduct(context, blingProductId);
  const payload = buildBlingProductUpdatePayload(remoteProduct, product);
  return await blingRequestWithTokenRefresh(context, `/produtos/${encodeURIComponent(blingProductId)}`, {
    method: "PUT",
    body: payload,
  });
}

export function productSyncBlingErrorMessage(error: BlingHttpError) {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para criar produto no Bling.";
  if (error.status === 404) return "Recurso nao encontrado no Bling.";
  if (error.status === 422) return "O Bling recusou os dados do produto. Revise nome, SKU e preco.";
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel sincronizar o produto no Bling.";
}

export function isRetryableProductSyncError(error: unknown) {
  if (error instanceof BlingHttpError) return error.temporary || error.status === 401;
  const message = error instanceof Error ? error.message : "";
  return ["bling_sync_in_progress", "bling_refresh_in_progress", "bling_refresh_lock_lost"].includes(message);
}

export async function syncSingleProductToBling(productId: string): Promise<SyncProductResult> {
  const product = await loadProduct(productId);
  if (!product) throw new Error("product_not_found");

  if (product.bling_product_id) {
    if (product.bling_sync_status === "review_required") {
      throw new Error("linked_product_review_required");
    }

    const variations = await loadProductVariations(product.id);
    const category = await loadCategory(product.category_id);

    try {
      validateProduct(product, variations, category);
    } catch (validationError) {
      const code = validationError instanceof Error ? validationError.message : "invalid_product";
      await markPreflightError(product.id, code, productSyncValidationMessage(code), product.bling_sync_metadata);
      throw validationError;
    }

    const syncAttemptId = crypto.randomUUID();
    let ownsSyncAttempt = await markSyncing(product.id, syncAttemptId);
    if (!ownsSyncAttempt) {
      const current = await loadProduct(product.id);
      if (current?.bling_sync_status === "syncing" && isStaleSyncMetadata(current.bling_sync_metadata)) {
        ownsSyncAttempt = await recoverStaleSyncing(product.id, syncAttemptId);
      }
      if (!ownsSyncAttempt) throw new Error("bling_sync_in_progress");
    }

    try {
      const connection = await loadActiveBlingConnection();
      const accessToken = await accessTokenForBlingConnection(connection);
      const context = { connection, accessToken };
      const blingResponse = await updateLinkedBlingProduct(context, product);
      const updatedProduct = await saveBlingProductUpdate(product.id, cleanText(product.bling_product_id), blingResponse, syncAttemptId);

      return {
        success: true,
        already_linked: true,
        linked_existing: false,
        updated_existing: true,
        bling_product_id: cleanText(updatedProduct.bling_product_id),
        product: updatedProduct,
      };
    } catch (error) {
      if (error instanceof BlingHttpError && error.status === 404) {
        const message = "Produto vinculado nao foi encontrado no Bling. Revisao administrativa necessaria.";
        await markProductReviewRequired(product.id, "linked_bling_product_not_found", message, {
          blingProductId: cleanText(product.bling_product_id),
        });
        throw new Error("linked_bling_product_not_found");
      } else {
        const message = error instanceof BlingHttpError ? productSyncBlingErrorMessage(error) : productSyncValidationMessage(error instanceof Error ? error.message : "internal_error");
        await markSyncError(product.id, syncAttemptId, error instanceof BlingHttpError ? "bling_api_error" : error instanceof Error ? error.message : "internal_error", message);
      }
      throw error;
    }
  }

  const variations = await loadProductVariations(product.id);
  const category = await loadCategory(product.category_id);

  try {
    validateProduct(product, variations, category);
  } catch (validationError) {
    const code = validationError instanceof Error ? validationError.message : "invalid_product";
    await markPreflightError(product.id, code, productSyncValidationMessage(code), product.bling_sync_metadata);
    throw validationError;
  }

  const connection = await loadActiveBlingConnection();
  const accessToken = await accessTokenForBlingConnection(connection);
  const context = { connection, accessToken };
  const sku = cleanText(product.sku);
  const existingProducts = await findBlingProductsByCode(context, sku);
  if (existingProducts.length > 1) throw new Error("ambiguous_bling_product_sku");

  const syncAttemptId = crypto.randomUUID();
  let ownsSyncAttempt = await markSyncing(product.id, syncAttemptId);
  if (!ownsSyncAttempt) {
    const current = await loadProduct(product.id);
    if (current?.bling_product_id) {
      return {
        success: true,
        already_linked: true,
        linked_existing: true,
        bling_product_id: current.bling_product_id,
        product: {
          id: current.id,
          bling_product_id: current.bling_product_id,
          bling_synced_at: current.bling_synced_at || null,
          bling_sync_status: "synced",
          bling_sync_error: "",
        },
      };
    }

    if (current?.bling_sync_status === "syncing" && isStaleSyncMetadata(current.bling_sync_metadata)) {
      ownsSyncAttempt = await recoverStaleSyncing(product.id, syncAttemptId);
    }

    if (!ownsSyncAttempt) throw new Error("bling_sync_in_progress");
  }

  try {
    if (existingProducts.length === 1) {
      const updatedProduct = await saveBlingProductLink(product.id, { data: existingProducts[0] }, syncAttemptId);
      return {
        success: true,
        already_linked: false,
        linked_existing: true,
        updated_existing: false,
        bling_product_id: cleanText(updatedProduct.bling_product_id),
        product: updatedProduct,
      };
    }

    const staleCheck = await findBlingProductsByCode(context, sku);
    if (staleCheck.length > 1) throw new Error("ambiguous_bling_product_sku");
    if (staleCheck.length === 1) {
      const updatedProduct = await saveBlingProductLink(product.id, { data: staleCheck[0] }, syncAttemptId);
      return {
        success: true,
        already_linked: false,
        linked_existing: true,
        updated_existing: false,
        bling_product_id: cleanText(updatedProduct.bling_product_id),
        product: updatedProduct,
      };
    }

    const payload = buildBlingProductPayload(product);
    const blingResponse = await blingRequestWithTokenRefresh(context, "/produtos", {
      method: "POST",
      body: payload,
    });
    const updatedProduct = await saveBlingProductLink(product.id, blingResponse, syncAttemptId);

    return {
      success: true,
      already_linked: false,
      linked_existing: false,
      updated_existing: false,
      bling_product_id: cleanText(updatedProduct.bling_product_id),
      product: updatedProduct,
    };
  } catch (error) {
    const message = error instanceof BlingHttpError ? productSyncBlingErrorMessage(error) : productSyncValidationMessage(error instanceof Error ? error.message : "internal_error");
    await markSyncError(product.id, syncAttemptId, error instanceof BlingHttpError ? "bling_api_error" : error instanceof Error ? error.message : "internal_error", message);
    throw error;
  }
}
