import { requireAdmin } from "../_shared/adminAuth.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { supabaseRest } from "../_shared/supabaseAdmin.ts";

type JobRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  available_at: string;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  name?: string | null;
  sku?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function summarize(rows: JobRow[]) {
  return rows.reduce((summary, job) => {
    const status = cleanText(job.status);
    summary.total += 1;
    if (status === "pending") summary.pending += 1;
    else if (status === "processing") summary.processing += 1;
    else if (status === "error") summary.error += 1;
    else if (status === "dead") summary.dead += 1;
    else if (status === "skipped") summary.skipped += 1;
    else if (status === "done") summary.done += 1;
    return summary;
  }, {
    total: 0,
    pending: 0,
    processing: 0,
    error: 0,
    dead: 0,
    skipped: 0,
    done: 0,
  });
}

async function loadProductNames(productIds: string[]) {
  if (!productIds.length) return new Map<string, ProductRow>();
  const ids = [...new Set(productIds)].slice(0, 50).join(",");
  const rows = await supabaseRest(
    `/products?id=in.(${ids})&select=id,name,sku`,
  );
  const map = new Map<string, ProductRow>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isObject(row) && row.id) map.set(String(row.id), row as ProductRow);
    }
  }
  return map;
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (!["GET", "POST"].includes(request.method)) return fail(request, "Metodo nao permitido.", 405);

    const auth = await requireAdmin(request);
    if (!auth.ok) return fail(request, auth.message, auth.status);

    const rows = await supabaseRest(
      "/bling_sync_jobs?select=id,entity_type,entity_id,operation,status,priority,attempts,max_attempts,available_at,last_error,created_at,updated_at"
      + "&status=in.(pending,processing,error,dead)"
      + "&order=priority.asc,available_at.asc,created_at.asc"
      + "&limit=30",
    );
    const jobs = Array.isArray(rows) ? rows as JobRow[] : [];
    const productMap = await loadProductNames(jobs.map((job) => job.entity_id));

    return ok(request, {
      summary: summarize(jobs),
      items: jobs.map((job) => {
        const product = productMap.get(job.entity_id);
        return {
          id: job.id,
          entity_type: job.entity_type,
          entity_id: job.entity_id,
          operation: job.operation,
          status: job.status,
          priority: job.priority,
          attempts: job.attempts,
          max_attempts: job.max_attempts,
          available_at: job.available_at,
          last_error: job.last_error || "",
          product_name: product?.name || "",
          sku: product?.sku || "",
          created_at: job.created_at,
          updated_at: job.updated_at,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao consultar fila Bling.";
    console.error("bling-sync-jobs-status", { message });
    return fail(request, "Erro interno ao consultar fila Bling.", 500);
  }
});
