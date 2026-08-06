import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { supabaseRpc } from "../_shared/supabaseAdmin.ts";

function authorized(request: Request) {
  const secret = Deno.env.get("STORE_CRON_SECRET") || "";
  if (!secret) return false;
  const headerSecret = request.headers.get("x-store-cron-secret") || "";
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return headerSecret === secret || bearer === secret;
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);
    if (!authorized(request)) return fail(request, "Nao autorizado.", 401);

    const result = await supabaseRpc("expire_store_orders", {
      p_limit: 100,
    });

    return ok(request, {
      result,
    });
  } catch (error) {
    console.error("expire-store-orders", error);
    return fail(request, error instanceof Error ? error.message : "Falha ao expirar pedidos da loja.", 500);
  }
});
