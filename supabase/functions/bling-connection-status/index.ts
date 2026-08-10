import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle } from "../_shared/supabaseAdmin.ts";

type SupabaseAuthUser = {
  id?: string;
  email?: string;
};

type BlingConnectionStatus = {
  status?: string;
  scopes?: string[] | null;
  connected_at?: string | null;
  last_refreshed_at?: string | null;
};

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

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (!["GET", "POST"].includes(request.method)) {
      return fail(request, "Metodo nao permitido.", 405);
    }

    const token = bearerToken(request);
    if (!token) return fail(request, "Nao autenticado.", 401);

    const user = await getUserFromJwt(token);
    if (!user?.id) return fail(request, "Nao autenticado.", 401);

    const admin = await isAdminUser(user.id);
    if (!admin) return fail(request, "Acesso restrito a administradores.", 403);

    const connection = await getSingle(
      "/bling_connections?connection_key=eq.nt-main&select=status,scopes,connected_at,last_refreshed_at&limit=1",
    ) as BlingConnectionStatus | null;

    return ok(request, {
      connected: connection?.status === "active",
      status: connection?.status || "not_connected",
      connected_at: connection?.connected_at || null,
      last_refreshed_at: connection?.last_refreshed_at || null,
      scopes: Array.isArray(connection?.scopes) ? connection.scopes : [],
    });
  } catch (error) {
    console.error("bling-connection-status", {
      message: error instanceof Error ? error.message : "Erro interno ao consultar status Bling.",
    });
    return fail(request, "Erro interno ao consultar status Bling.", 500);
  }
});
