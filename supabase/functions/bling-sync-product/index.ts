import { BlingHttpError } from "../_shared/bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
  type BlingAccessContext,
} from "../_shared/blingConnection.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type SupabaseAuthUser = {
  id?: string;
  email?: string;
};

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

type SyncProductResult = {
  success: boolean;
  already_linked: boolean;
  linked_existing: boolean;
  bling_product_id: string | null;
  product: JsonObject | null;
};

const PRODUCT_SELECT = [
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

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text) return {};
  const payload = JSON.parse(text);
  return isObject(payload) ? payload : {};
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
  if (product.bling_product_id) throw new Error("already_linked");
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

function validationMessage(code: string) {
  const messages: Record<string, string> = {
    invalid_product: "Produto invalido para envio ao Bling.",
    missing_product_sku: "Produto sem SKU para localizar ou criar no Bling.",
    invalid_product_sku: "SKU do produto possui caracteres incompatíveis com a sincronizacao.",
    missing_product_name: "Produto sem nome para enviar ao Bling.",
    invalid_product_price: "Produto sem preco valido para enviar ao Bling.",
    draft_product: "Produto em rascunho nao sera enviado ao Bling.",
    invalid_product_status: "Status do produto nao e compativel com sincronizacao.",
    invalid_product_category: "Categoria do produto nao foi encontrada.",
    inactive_product_category: "Categoria do produto esta inativa.",
    product_variations_not_supported: "Produto com variacoes ainda nao e sincronizado nesta etapa. Sincronize um produto simples primeiro.",
    missing_bling_product_id: "O Bling retornou uma resposta sem ID de produto.",
    ambiguous_bling_product_sku: "Mais de um produto foi encontrado no Bling com o mesmo SKU. Resolva a duplicidade antes de vincular.",
    bling_sync_lock_lost: "Outra tentativa alterou a sincronizacao do produto. Atualize e tente novamente.",
  };
  return messages[code] || "Produto nao esta completo para envio ao Bling.";
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
    + "&bling_product_id=is.null"
    + "&bling_sync_status=in.(not_sent,error)"
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

async function markPreflightError(productId: string, errorCode: string, message: string) {
  await supabaseRest(
    `/products?id=eq.${encodeURIComponent(productId)}`
    + "&bling_product_id=is.null"
    + "&bling_sync_status=in.(not_sent,error)"
    + "&select=id",
    {
      method: "PATCH",
      body: JSON.stringify({
        bling_sync_status: "error",
        bling_sync_error: message,
        bling_sync_metadata: {
          errorCode,
          failedAt: nowIso(),
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

function blingErrorMessage(error: BlingHttpError) {
  if (error.status === 401) return "Token do Bling invalido ou expirado.";
  if (error.status === 403) return "Escopo insuficiente para criar produto no Bling.";
  if (error.status === 404) return "Recurso nao encontrado no Bling.";
  if (error.status === 422) return "O Bling recusou os dados do produto. Revise nome, SKU e preco.";
  if (error.status === 429) return "Limite de requisicoes do Bling atingido. Tente novamente em instantes.";
  if (error.status >= 500) return "Erro temporario na API do Bling.";
  return "Nao foi possivel sincronizar o produto no Bling.";
}

export async function syncSingleProductToBling(productId: string, _adminUserId: string): Promise<SyncProductResult> {
  const product = await loadProduct(productId);
  if (!product) throw new Error("product_not_found");

  if (product.bling_product_id) {
    return {
      success: true,
      already_linked: true,
      linked_existing: true,
      bling_product_id: product.bling_product_id,
      product: {
        id: product.id,
        bling_product_id: product.bling_product_id,
        bling_synced_at: product.bling_synced_at || null,
        bling_sync_status: "synced",
        bling_sync_error: "",
      },
    };
  }

  const variations = await loadProductVariations(product.id);
  const category = await loadCategory(product.category_id);

  try {
    validateProduct(product, variations, category);
  } catch (validationError) {
    const code = validationError instanceof Error ? validationError.message : "invalid_product";
    await markPreflightError(product.id, code, validationMessage(code));
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
        bling_product_id: cleanText(updatedProduct.bling_product_id),
        product: updatedProduct,
      };
    }

    if (!ownsSyncAttempt) throw new Error("bling_sync_lock_lost");

    const staleCheck = await findBlingProductsByCode(context, sku);
    if (staleCheck.length > 1) throw new Error("ambiguous_bling_product_sku");
    if (staleCheck.length === 1) {
      const updatedProduct = await saveBlingProductLink(product.id, { data: staleCheck[0] }, syncAttemptId);
      return {
        success: true,
        already_linked: false,
        linked_existing: true,
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
      bling_product_id: cleanText(updatedProduct.bling_product_id),
      product: updatedProduct,
    };
  } catch (error) {
    const message = error instanceof BlingHttpError ? blingErrorMessage(error) : validationMessage(error instanceof Error ? error.message : "internal_error");
    await markSyncError(product.id, syncAttemptId, error instanceof BlingHttpError ? "bling_api_error" : error instanceof Error ? error.message : "internal_error", message);
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

    const result = await syncSingleProductToBling(productId, user.id);
    return ok(request, result);
  } catch (error) {
    if (error instanceof BlingHttpError) {
      console.error("bling-sync-product BlingHttpError", {
        status: error.status,
        temporary: error.temporary,
      });
      return fail(request, blingErrorMessage(error), error.temporary ? 503 : error.status, {
        code: "bling_api_error",
        status: error.status,
      });
    }

    const message = error instanceof Error ? error.message : "Erro interno ao sincronizar produto no Bling.";
    console.error("bling-sync-product", { message });

    if (message === "product_not_found") return fail(request, "Produto nao encontrado.", 404, { code: message });
    if (message === "bling_not_connected") return fail(request, "Bling nao conectado.", 409, { code: message });
    if (message === "bling_not_active") return fail(request, "Conexao Bling nao esta ativa.", 409, { code: message });
    if (message === "bling_access_token_missing") return fail(request, "Access token do Bling ausente.", 409, { code: message });
    if (message === "bling_refresh_token_missing") return fail(request, "Refresh token do Bling ausente.", 409, { code: message });
    if (message === "bling_refresh_in_progress") return fail(request, "Token do Bling esta sendo renovado. Tente novamente em instantes.", 409, { code: message });
    if (message === "bling_refresh_lock_lost") return fail(request, "Outra tentativa renovou a conexao Bling. Tente novamente.", 409, { code: message });
    if (message === "bling_sync_in_progress") return fail(request, "Produto ja esta em envio ao Bling. Aguarde a conclusao.", 409, { code: message });
    if (message === "bling_sync_lock_lost") return fail(request, validationMessage(message), 409, { code: message });

    const knownMessage = validationMessage(message);
    if (knownMessage !== validationMessage("unknown")) {
      return fail(request, knownMessage, 422, { code: message });
    }

    return fail(request, "Erro interno ao sincronizar produto no Bling.", 500);
  }
});
