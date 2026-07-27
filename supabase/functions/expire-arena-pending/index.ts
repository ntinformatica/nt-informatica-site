import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { supabaseRpc } from "../_shared/supabaseAdmin.ts";

function authorized(request: Request) {
  const secret = Deno.env.get("ARENA_CRON_SECRET") || "";
  if (!secret) return false;
  const headerSecret = request.headers.get("x-arena-cron-secret") || "";
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return headerSecret === secret || bearer === secret;
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);
    if (!authorized(request)) return fail(request, "Nao autorizado.", 401);

    const rows = await supabaseRpc("expire_arena_pending_reservations", {});
    return ok(request, {
      expired: Array.isArray(rows) ? rows.length : 0,
      rows: rows || [],
    });
  } catch (error) {
    console.error("expire-arena-pending", error);
    return fail(request, error instanceof Error ? error.message : "Falha ao expirar reservas pendentes.", 500);
  }
});
