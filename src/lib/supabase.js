const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function cleanEnvValue(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function normalizeSupabaseUrl(value) {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return "";

  const withoutRestPath = cleaned.replace(/\/rest\/v1\/?$/i, "");
  return withoutRestPath.replace(/\/+$/, "");
}

function normalizeAnonKey(value) {
  return cleanEnvValue(value).replace(/\s+/g, "");
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = normalizeAnonKey(rawSupabaseAnonKey);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function assertSupabaseUrl() {
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function supabaseHost() {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return "";
  }
}

export const supabaseDiagnostics = {
  configured: isSupabaseConfigured,
  validUrl: isSupabaseConfigured ? assertSupabaseUrl() : false,
  urlHost: isSupabaseConfigured ? supabaseHost() : "",
  keyLoaded: Boolean(supabaseAnonKey),
  keyLength: supabaseAnonKey.length,
};

function buildUrl(path) {
  if (!assertSupabaseUrl()) {
    throw new Error("URL do Supabase invalida. Use o Project URL no formato https://xxxx.supabase.co.");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${supabaseUrl}/rest/v1${cleanPath}`;
}

export async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase nao configurado.");
  }

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    Accept: "application/json",
    Prefer: "return=representation",
    ...options.headers,
  };

  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(buildUrl(path), {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(`Falha de conexao com Supabase (${supabaseDiagnostics.urlHost || "URL nao configurada"}): ${error.message}`);
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Erro Supabase: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}
