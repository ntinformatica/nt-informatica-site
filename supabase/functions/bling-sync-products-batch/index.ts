import { BlingHttpError } from "../_shared/bling.ts";
import { cleanText, requireAdmin, readJsonBody } from "../_shared/adminAuth.ts";
import {
  isRetryableProductSyncError,
  productSyncBlingErrorMessage,
  productSyncValidationMessage,
  syncSingleProductToBling,
} from "../_shared/blingProductSync.ts";
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

function productErrorMessage(error: unknown) {
  if (error instanceof BlingHttpError) return productSyncBlingErrorMessage(error);
  return productSyncValidationMessage(error instanceof Error ? error.message : "internal_error");
}

function productErrorCode(error: unknown) {
  if (error instanceof BlingHttpError) return "bling_api_error";
  return error instanceof Error ? error.message : "internal_error";
}

async function listCandidateProducts(params: { mode: string; limit: number; cursor: string }) {
  const limitWithLookahead = params.limit + 1;
  let path = `/products?select=id,sku,bling_product_id,bling_sync_status&id=gt.${encodeURIComponent(params.cursor || "00000000-0000-0000-0000-000000000000")}&order=id.asc&limit=${limitWithLookahead}`;

  if (params.mode === "retry_errors") {
    path += "&bling_product_id=is.null&bling_sync_status=in.(error,review_required)";
  } else if (params.mode === "all_pending") {
    path += "&bling_product_id=is.null&bling_sync_status=in.(not_sent,dirty,error,review_required)";
  } else {
    path += "&bling_product_id=is.null&bling_sync_status=in.(not_sent,dirty,review_required)";
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
      synced: 0,
      linked_existing: 0,
      skipped: 0,
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
        const result = await syncSingleProductToBling(productId);
        if (result.linked_existing || result.already_linked) summary.linked_existing += 1;
        else summary.synced += 1;
        summary.items.push({
          product_id: productId,
          sku,
          status: result.linked_existing ? "linked_existing" : result.already_linked ? "already_linked" : "synced",
          bling_product_id: result.bling_product_id,
        });
      } catch (error) {
        const code = productErrorCode(error);
        const retryable = isRetryableProductSyncError(error);
        const skipped = ["product_variations_not_supported", "draft_product", "missing_product_sku", "invalid_product_sku", "invalid_product_price"].includes(code);
        if (skipped) summary.skipped += 1;
        else summary.errors += 1;
        if (retryable) summary.retryable_errors += 1;
        summary.items.push({
          product_id: productId,
          sku,
          status: skipped ? "skipped" : "error",
          code,
          retryable,
          message: productErrorMessage(error),
        });
      }

      nextCursor = productId;
      await sleep(RATE_DELAY_MS);
    }

    summary.has_more = hasMore;
    summary.next_cursor = nextCursor || null;
    return ok(request, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao sincronizar produtos em lote.";
    console.error("bling-sync-products-batch", { message });
    return fail(request, "Erro interno ao sincronizar produtos em lote.", 500);
  }
});
