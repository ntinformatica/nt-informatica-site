import { BlingHttpError } from "../_shared/bling.ts";
import { cleanText, requireAdmin, readJsonBody } from "../_shared/adminAuth.ts";
import {
  isRetryableProductSyncError,
  isUnsupportedProductSyncCode,
  productSyncBlingErrorMessage,
  productSyncValidationMessage,
  syncSingleProductToBling,
} from "../_shared/blingProductSync.ts";
import {
  isRetryableStockSyncError,
  stockSyncBlingErrorMessage,
  stockSyncValidationMessage,
  syncSingleProductStockToBling,
} from "../_shared/blingStockSync.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { supabaseRpc } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type BlingSyncJob = {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  status: string;
  attempts: number;
  max_attempts: number;
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const CRON_SECRET_HEADER = "x-nt-cron-secret";

function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLength = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (aBytes[index] || 0) ^ (bBytes[index] || 0);
  }

  return diff === 0;
}

function isCronRequest(request: Request) {
  const configuredSecret = Deno.env.get("BLING_WORKER_CRON_SECRET") || "";
  const receivedSecret = request.headers.get(CRON_SECRET_HEADER) || "";
  if (!configuredSecret || !receivedSecret) return false;
  return timingSafeEqual(receivedSecret, configuredSecret);
}

function hasCronSecret(request: Request) {
  return Boolean(request.headers.get(CRON_SECRET_HEADER));
}

function positiveLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function backoffMinutes(attempts: number) {
  return Math.min(60, Math.max(1, 2 ** Math.max(0, attempts - 1)));
}

function retryIntervalText(attempts: number) {
  return `${backoffMinutes(attempts)} minutes`;
}

function errorMessage(error: unknown, operation: string) {
  if (error instanceof BlingHttpError) {
    return operation === "stock_sync" ? stockSyncBlingErrorMessage(error) : productSyncBlingErrorMessage(error);
  }
  return operation === "stock_sync"
    ? stockSyncValidationMessage(error instanceof Error ? error.message : "internal_error")
    : productSyncValidationMessage(error instanceof Error ? error.message : "internal_error");
}

function errorCode(error: unknown) {
  if (error instanceof BlingHttpError) return "bling_api_error";
  return error instanceof Error ? error.message : "internal_error";
}

function isRetryable(error: unknown, operation: string) {
  return operation === "stock_sync" ? isRetryableStockSyncError(error) : isRetryableProductSyncError(error);
}

function isSkipped(error: unknown, operation: string) {
  if (operation !== "product_sync" || error instanceof BlingHttpError) return false;
  return isUnsupportedProductSyncCode(errorCode(error));
}

async function acquireJobs(workerId: string, limit: number) {
  const rows = await supabaseRpc("acquire_bling_sync_jobs", {
    p_worker_id: workerId,
    p_limit: limit,
  });
  return Array.isArray(rows) ? rows as BlingSyncJob[] : [];
}

async function finishJob(
  job: BlingSyncJob,
  workerId: string,
  status: "done" | "pending" | "error" | "dead" | "skipped",
  message = "",
  metadata: JsonObject = {},
) {
  return await supabaseRpc("finish_bling_sync_job", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_status: status,
    p_last_error: message,
    p_retry_after: status === "pending" ? retryIntervalText(job.attempts) : null,
    p_metadata: metadata,
  });
}

async function processJob(job: BlingSyncJob) {
  if (job.entity_type !== "product") throw new Error("unsupported_entity_type");
  if (job.operation === "product_sync") return await syncSingleProductToBling(job.entity_id);
  if (job.operation === "stock_sync") return await syncSingleProductStockToBling(job.entity_id);
  throw new Error("unsupported_operation");
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const cronSecretPresent = hasCronSecret(request);
    const cronRequest = cronSecretPresent ? isCronRequest(request) : false;
    if (cronSecretPresent && !Deno.env.get("BLING_WORKER_CRON_SECRET")) {
      return fail(request, "Cron Bling nao configurado.", 500);
    }
    if (cronSecretPresent && !cronRequest) {
      return fail(request, "Credencial do cron Bling invalida.", 403);
    }
    if (!cronRequest) {
      const auth = await requireAdmin(request);
      if (!auth.ok) return fail(request, auth.message, auth.status);
    }

    const body = await readJsonBody(request);
    const limit = positiveLimit(body.limit);
    const workerId = `${cronRequest ? "cron" : "edge"}-${crypto.randomUUID()}`;
    const jobs = await acquireJobs(workerId, limit);
    const summary = {
      worker_id: workerId,
      acquired: jobs.length,
      done: 0,
      retried: 0,
      dead: 0,
      skipped: 0,
      errors: 0,
      items: [] as JsonObject[],
    };

    for (const job of jobs) {
      try {
        const result = await processJob(job);
        await finishJob(job, workerId, "done", "", {
          finishedAt: new Date().toISOString(),
          result,
        });
        summary.done += 1;
        summary.items.push({
          job_id: job.id,
          operation: job.operation,
          entity_id: job.entity_id,
          status: "done",
        });
      } catch (error) {
        const retryable = isRetryable(error, job.operation);
        const skipped = isSkipped(error, job.operation);
        const message = errorMessage(error, job.operation);
        const code = errorCode(error);
        const finalStatus = skipped ? "skipped" : retryable && job.attempts < job.max_attempts ? "pending" : retryable ? "dead" : "error";
        await finishJob(job, workerId, finalStatus, message, {
          failedAt: new Date().toISOString(),
          code,
          retryable,
          skipped,
        });
        if (finalStatus === "pending") summary.retried += 1;
        else if (finalStatus === "dead") summary.dead += 1;
        else if (finalStatus === "skipped") summary.skipped += 1;
        else summary.errors += 1;
        summary.items.push({
          job_id: job.id,
          operation: job.operation,
          entity_id: job.entity_id,
          status: finalStatus,
          code,
          retryable,
          message,
        });
      }
    }

    return ok(request, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao processar fila Bling.";
    console.error("bling-process-sync-jobs", { message });
    if (message.includes("acquire_bling_sync_jobs") || message.includes("finish_bling_sync_job")) {
      return fail(request, "SQL da fila Bling ainda nao foi aplicado.", 409, { code: "missing_bling_jobs_sql" });
    }
    return fail(request, "Erro interno ao processar fila Bling.", 500);
  }
});
