import { BlingHttpError } from "../_shared/bling.ts";
import { cleanText, requireAdmin, readJsonBody } from "../_shared/adminAuth.ts";
import {
  isRetryableStockSyncError,
  stockSyncBlingErrorMessage,
  stockSyncValidationMessage,
  syncSingleProductStockToBling,
} from "../_shared/blingStockSync.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { supabaseRest } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const RATE_DELAY_MS = 450;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function positiveLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function safeCursor(value: unknown) {
  const clean = cleanText(value);
  return /^[0-9a-f-]{36}$/i.test(clean) ? clean : "";
}

function stockErrorMessage(error: unknown) {
  if (error instanceof BlingHttpError) return stockSyncBlingErrorMessage(error);
  return stockSyncValidationMessage(error instanceof Error ? error.message : "internal_error");
}

function stockErrorCode(error: unknown) {
  if (error instanceof BlingHttpError) return "bling_api_error";
  return error instanceof Error ? error.message : "internal_error";
}

async function listCandidateProducts(params: { mode: string; limit: number; cursor: string }) {
  const limitWithLookahead = params.limit + 1;
  let path = `/products?select=id,sku,bling_product_id,bling_stock_sync_status&id=gt.${encodeURIComponent(params.cursor || "00000000-0000-0000-0000-000000000000")}&order=id.asc&limit=${limitWithLookahead}&bling_product_id=not.is.null`;

  if (params.mode === "retry_errors") {
    path += "&bling_stock_sync_status=eq.error";
  } else if (params.mode === "all_pending") {
    path += "&bling_stock_sync_status=in.(not_synced,dirty,error)";
  } else {
    path += "&bling_stock_sync_status=in.(not_synced,dirty)";
  }

  const rows = await supabaseRest(path);
  return Array.isArray(rows) ? rows : [];
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const auth = await requireAdmin(request);
    if (!auth.ok) return fail(request, auth.message, auth.status);

    const body = await readJsonBody(request);
    const mode = ["pending", "all_pending", "retry_errors"].includes(cleanText(body.mode)) ? cleanText(body.mode) : "pending";
    const limit = positiveLimit(body.limit);
    const cursor = safeCursor(body.cursor);
    const rows = await listCandidateProducts({ mode, limit, cursor });
    const slice = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    let nextCursor = slice.length ? cleanText(slice[slice.length - 1].id) : cursor;

    const summary = {
      processed: 0,
      noops: 0,
      entries: 0,
      exits: 0,
      errors: 0,
      retryable_errors: 0,
      has_more: hasMore,
      next_cursor: nextCursor || null,
      items: [] as JsonObject[],
    };

    for (const product of slice) {
      const productId = cleanText(product.id);
      const sku = cleanText(product.sku);
      summary.processed += 1;

      try {
        const result = await syncSingleProductStockToBling(productId);
        if (result.delta === 0) summary.noops += 1;
        else if (result.delta > 0) summary.entries += 1;
        else summary.exits += 1;
        summary.items.push({
          product_id: productId,
          sku,
          status: result.delta === 0 ? "noop" : "synced",
          delta: result.delta,
          operation: result.operation,
          nt_stock: result.nt_stock,
          bling_stock_before: result.bling_stock_before,
        });
      } catch (error) {
        const code = stockErrorCode(error);
        const retryable = isRetryableStockSyncError(error);
        summary.errors += 1;
        if (retryable) summary.retryable_errors += 1;
        summary.items.push({
          product_id: productId,
          sku,
          status: "error",
          code,
          retryable,
          message: stockErrorMessage(error),
        });
      }

      nextCursor = productId;
      await sleep(RATE_DELAY_MS);
    }

    summary.has_more = hasMore;
    summary.next_cursor = nextCursor || null;
    return ok(request, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao sincronizar estoques em lote.";
    console.error("bling-sync-stocks-batch", { message });
    return fail(request, "Erro interno ao sincronizar estoques em lote.", 500);
  }
});
