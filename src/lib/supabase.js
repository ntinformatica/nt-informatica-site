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
const authStorageKey = "nt-supabase-auth-session-v1";
const authListeners = new Set();

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

function buildStorageUrl(path) {
  if (!assertSupabaseUrl()) {
    throw new Error("URL do Supabase invalida. Use o Project URL no formato https://xxxx.supabase.co.");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${supabaseUrl}/storage/v1${cleanPath}`;
}

function buildAuthUrl(path) {
  if (!assertSupabaseUrl()) {
    throw new Error("URL do Supabase invalida. Use o Project URL no formato https://xxxx.supabase.co.");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${supabaseUrl}/auth/v1${cleanPath}`;
}

function readAuthSession() {
  try {
    const stored = localStorage.getItem(authStorageKey);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function writeAuthSession(session) {
  if (!session) {
    localStorage.removeItem(authStorageKey);
    return;
  }

  localStorage.setItem(authStorageKey, JSON.stringify(session));
}

function emitAuthChange(event, session) {
  authListeners.forEach((listener) => {
    try {
      listener(event, session);
    } catch (error) {
      console.error("Erro em listener de autenticacao Supabase:", error);
    }
  });
}

function authHeaders(accessToken = "") {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function authRequest(path, options = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase nao configurado.");
  }

  const { accessToken = "", headers: customHeaders = {}, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(buildAuthUrl(path), {
      ...fetchOptions,
      headers: {
        ...authHeaders(accessToken),
        ...customHeaders,
      },
    });
  } catch (error) {
    throw new Error(`Falha de conexao com Supabase Auth (${supabaseDiagnostics.urlHost || "URL nao configurada"}): ${error.message}`);
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Erro Supabase Auth: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeAuthSession(payload) {
  if (!payload?.access_token) return null;
  const expiresAt = payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600);
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || "",
    token_type: payload.token_type || "bearer",
    expires_at: expiresAt,
    expires_in: payload.expires_in,
    user: payload.user || null,
  };
}

async function refreshAuthSession(session) {
  if (!session?.refresh_token) return null;
  const payload = await authRequest("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const nextSession = normalizeAuthSession(payload);
  writeAuthSession(nextSession);
  emitAuthChange("TOKEN_REFRESHED", nextSession);
  return nextSession;
}

async function getValidAuthSession() {
  const session = readAuthSession();
  if (!session?.access_token) return null;

  const expiresAt = Number(session.expires_at || 0);
  const shouldRefresh = expiresAt && expiresAt < Math.floor(Date.now() / 1000) + 60;
  if (shouldRefresh) {
    try {
      return await refreshAuthSession(session);
    } catch {
      writeAuthSession(null);
      return null;
    }
  }

  try {
    const user = await authRequest("/user", {
      method: "GET",
      accessToken: session.access_token,
    });
    const nextSession = { ...session, user };
    writeAuthSession(nextSession);
    return nextSession;
  } catch {
    writeAuthSession(null);
    return null;
  }
}

export const supabase = {
  auth: {
    async signInWithPassword({ email, password }) {
      try {
        const payload = await authRequest("/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const session = normalizeAuthSession(payload);
        writeAuthSession(session);
        emitAuthChange("SIGNED_IN", session);
        return { data: { session, user: session?.user || null }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error };
      }
    },
    async getSession() {
      try {
        const session = await getValidAuthSession();
        return { data: { session }, error: null };
      } catch (error) {
        return { data: { session: null }, error };
      }
    },
    onAuthStateChange(callback) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
    async signOut() {
      const session = readAuthSession();
      try {
        if (session?.access_token) {
          await authRequest("/logout", {
            method: "POST",
            accessToken: session.access_token,
          });
        }
      } catch (error) {
        console.warn("Nao foi possivel encerrar a sessao no Supabase Auth:", error);
      } finally {
        writeAuthSession(null);
        emitAuthChange("SIGNED_OUT", null);
      }
      return { error: null };
    },
  },
};

export async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase nao configurado.");
  }

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${readAuthSession()?.access_token || supabaseAnonKey}`,
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

export function storagePublicUrl(bucket, path) {
  if (!assertSupabaseUrl()) {
    throw new Error("URL do Supabase invalida. Use o Project URL no formato https://xxxx.supabase.co.");
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function storagePathFromPublicUrl(bucket, publicUrl) {
  if (!publicUrl || !assertSupabaseUrl()) return "";

  try {
    const parsed = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (!parsed.pathname.startsWith(prefix)) return "";
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return "";
  }
}

export function uploadStorageFile(bucket, path, file, onProgress) {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error("Supabase Storage nao configurado."));
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", buildStorageUrl(`/object/${bucket}/${path}`));
    request.setRequestHeader("apikey", supabaseAnonKey);
    request.setRequestHeader("Authorization", `Bearer ${supabaseAnonKey}`);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve({
          path,
          publicUrl: storagePublicUrl(bucket, path),
        });
        return;
      }

      reject(new Error(request.responseText || `Falha no envio da imagem (${request.status}).`));
    };

    request.onerror = () => reject(new Error("Falha de conexão ao enviar imagem."));
    request.send(file);
  });
}

export async function deleteStorageFile(bucket, path) {
  if (!isSupabaseConfigured || !path) return false;

  const response = await fetch(buildStorageUrl(`/object/${bucket}`), {
    method: "DELETE",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [path] }),
  });

  if (!response.ok) {
    throw new Error(await response.text() || "Falha ao remover imagem do Storage.");
  }

  return true;
}
