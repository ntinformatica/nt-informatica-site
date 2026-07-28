import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { supabaseRpc } from "../_shared/supabaseAdmin.ts";
import { readJson, requireUuid } from "../_shared/validation.ts";

function fromRows(rows: unknown) {
  return Array.isArray(rows) ? rows[0] || null : rows;
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (!["GET", "POST"].includes(request.method)) return fail(request, "Metodo nao permitido.", 405);

    const url = new URL(request.url);
    const payload = request.method === "POST" ? await readJson(request) : {};
    const planPaymentId = payload.planPaymentId || url.searchParams.get("planPaymentId");

    if (!planPaymentId) return fail(request, "Informe planPaymentId.");

    const rows = await supabaseRpc("get_arena_plan_payment_status", {
      p_plan_payment_id: requireUuid(planPaymentId, "planPaymentId"),
    });
    const planPayment = fromRows(rows) as Record<string, unknown> | null;

    if (!planPayment) return fail(request, "Pagamento de plano nao encontrado.", 404);

    return ok(request, {
      planPayment,
      pix: {
        pixCopyPaste: planPayment.qr_code || "",
        qrCodeBase64: planPayment.qr_code_base64 || "",
        ticketUrl: planPayment.ticket_url || "",
      },
    });
  } catch (error) {
    console.error("get-arena-plan-payment-status", error);
    return fail(request, error instanceof Error ? error.message : "Falha ao consultar pagamento do plano.", 500);
  }
});
