import { corsHeaders } from "./cors.ts";

export function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function ok(request: Request, body: Record<string, unknown> = {}) {
  return jsonResponse(request, { ok: true, ...body });
}

export function fail(request: Request, message: string, status = 400, details?: unknown) {
  return jsonResponse(request, { ok: false, error: message, details }, status);
}
