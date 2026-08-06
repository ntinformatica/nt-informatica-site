const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://nt-informatica-site.vercel.app",
];

function configuredOrigins() {
  return String(Deno.env.get("SITE_URL") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [...defaultAllowedOrigins, ...configuredOrigins()];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-arena-cron-secret, x-store-cron-secret, x-signature, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

export function handleCors(request: Request) {
  if (request.method !== "OPTIONS") return null;
  return new Response("ok", { headers: corsHeaders(request) });
}
