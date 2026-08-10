import {
  buildBlingAuthorizationUrl,
  generateBlingOAuthState,
  hashBlingOAuthState,
  validateBlingConfig,
} from "../_shared/bling.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest } from "../_shared/supabaseAdmin.ts";

type SupabaseAuthUser = {
  id?: string;
  email?: string;
};

const STATE_TTL_MINUTES = 10;

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

async function cleanupExpiredStates(now: Date) {
  await supabaseRest(
    `/bling_oauth_states?expires_at=lt.${encodeURIComponent(now.toISOString())}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  ).catch((error) => {
    console.warn("bling-oauth-start cleanup skipped", {
      message: error instanceof Error ? error.message : "Falha ao limpar states expirados.",
    });
  });
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    validateBlingConfig();

    const token = bearerToken(request);
    if (!token) return fail(request, "Nao autenticado.", 401);

    const user = await getUserFromJwt(token);
    if (!user?.id) return fail(request, "Nao autenticado.", 401);

    const admin = await isAdminUser(user.id);
    if (!admin) return fail(request, "Acesso restrito a administradores.", 403);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + STATE_TTL_MINUTES * 60 * 1000).toISOString();
    const state = generateBlingOAuthState();
    const stateHash = await hashBlingOAuthState(state);

    await cleanupExpiredStates(now);

    await supabaseRest("/bling_oauth_states", {
      method: "POST",
      body: JSON.stringify({
        state_hash: stateHash,
        admin_user_id: user.id,
        expires_at: expiresAt,
        consumed_at: null,
      }),
    });

    const authorizationUrl = buildBlingAuthorizationUrl({ state });

    return ok(request, {
      authorization_url: authorizationUrl,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("bling-oauth-start", {
      message: error instanceof Error ? error.message : "Erro interno ao iniciar OAuth Bling.",
    });
    return fail(
      request,
      error instanceof Error ? error.message : "Erro interno ao iniciar OAuth Bling.",
      500,
    );
  }
});
