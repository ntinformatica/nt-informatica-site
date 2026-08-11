import { getSingle } from "./supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

export type SupabaseAuthUser = {
  id?: string;
  email?: string;
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

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

export function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value));
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

export async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text) return {};
  const payload = JSON.parse(text);
  return isObject(payload) ? payload : {};
}

export async function getUserFromJwt(token: string) {
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

export async function isAdminUser(userId: string) {
  const adminUser = await getSingle(
    `/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
  );
  return Boolean(adminUser);
}

export async function requireAdmin(request: Request) {
  const token = bearerToken(request);
  if (!token) return { ok: false as const, status: 401, message: "Nao autenticado." };

  const user = await getUserFromJwt(token);
  if (!user?.id) return { ok: false as const, status: 401, message: "Nao autenticado." };

  const admin = await isAdminUser(user.id);
  if (!admin) return { ok: false as const, status: 403, message: "Acesso restrito a administradores." };

  return { ok: true as const, user };
}
