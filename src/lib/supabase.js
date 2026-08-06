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

function buildFunctionUrl(name) {
  if (!assertSupabaseUrl()) {
    throw new Error("URL do Supabase invalida. Use o Project URL no formato https://xxxx.supabase.co.");
  }
  return `${supabaseUrl}/functions/v1/${name}`;
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
    async signUp({ email, password, options = {} }) {
      try {
        const payload = await authRequest("/signup", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            data: options.data || {},
          }),
        });
        const session = normalizeAuthSession(payload);
        if (session) {
          writeAuthSession(session);
          emitAuthChange("SIGNED_IN", session);
        }
        return { data: { session, user: payload?.user || session?.user || null }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error };
      }
    },
    async resetPasswordForEmail(email, options = {}) {
      try {
        const redirectTo = options.redirectTo ? `?redirect_to=${encodeURIComponent(options.redirectTo)}` : "";
        await authRequest(`/recover${redirectTo}`, {
          method: "POST",
          body: JSON.stringify({
            email,
            gotrue_meta_security: {},
          }),
        });
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async setSession({ access_token, refresh_token }) {
      try {
        if (!access_token) throw new Error("Token de acesso ausente.");
        const user = await authRequest("/user", {
          method: "GET",
          accessToken: access_token,
        });
        const session = normalizeAuthSession({
          access_token,
          refresh_token,
          token_type: "bearer",
          expires_in: 3600,
          user,
        });
        writeAuthSession(session);
        emitAuthChange("SIGNED_IN", session);
        return { data: { session, user }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error };
      }
    },
    async updateUser(attributes) {
      try {
        const session = readAuthSession();
        if (!session?.access_token) throw new Error("Sessao nao encontrada.");
        const user = await authRequest("/user", {
          method: "PUT",
          accessToken: session.access_token,
          body: JSON.stringify(attributes),
        });
        const nextSession = { ...session, user };
        writeAuthSession(nextSession);
        emitAuthChange("USER_UPDATED", nextSession);
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error };
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
    async signOut(options = {}) {
      const session = readAuthSession();
      try {
        if (session?.access_token) {
          const scope = options.scope ? `?scope=${encodeURIComponent(options.scope)}` : "";
          await authRequest(`/logout${scope}`, {
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

  const { returnMeta = false, forceAnon = false, ...requestOptions } = options;
  const accessToken = forceAnon ? supabaseAnonKey : (readAuthSession()?.access_token || supabaseAnonKey);
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    Prefer: "return=representation",
    ...requestOptions.headers,
  };

  if (requestOptions.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(buildUrl(path), {
      ...requestOptions,
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
  const data = await response.json();
  if (!returnMeta) return data;

  const contentRange = response.headers.get("content-range") || "";
  const total = contentRange.includes("/") ? Number(contentRange.split("/").pop()) : null;
  return {
    data,
    total: Number.isFinite(total) ? total : null,
    contentRange,
  };
}

export async function supabaseFunction(name, options = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase nao configurado.");
  }

  const session = readAuthSession();
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(buildFunctionUrl(name), {
    ...options,
    headers,
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok || payload?.ok === false) {
    const message = payload?.error || payload?.message || text || `Erro na funcao ${name}: ${response.status}`;
    console.error("Falha na Edge Function Supabase:", {
      name,
      status: response.status,
      message,
      details: payload?.details || null,
    });
    const error = new Error(message);
    error.status = response.status;
    error.details = payload?.details || null;
    throw error;
  }
  return payload;
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

export function uploadPrivateStorageFile(bucket, path, file, onProgress) {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error("Supabase Storage nao configurado."));
  }

  return new Promise((resolve, reject) => {
    const session = readAuthSession();
    const request = new XMLHttpRequest();
    request.open("POST", buildStorageUrl(`/object/${bucket}/${path}`));
    request.setRequestHeader("apikey", supabaseAnonKey);
    request.setRequestHeader("Authorization", `Bearer ${session?.access_token || supabaseAnonKey}`);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve({ path });
        return;
      }

      reject(new Error(request.responseText || `Falha no envio do arquivo (${request.status}).`));
    };

    request.onerror = () => reject(new Error("Falha de conexao ao enviar arquivo."));
    request.send(file);
  });
}

export async function createStorageSignedUrl(bucket, path, expiresIn = 300) {
  if (!isSupabaseConfigured || !path) {
    throw new Error("Arquivo nao informado.");
  }

  const session = readAuthSession();
  const response = await fetch(buildStorageUrl(`/object/sign/${bucket}/${path}`), {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
  });

  if (!response.ok) {
    throw new Error(await response.text() || "Falha ao gerar link temporario.");
  }

  const data = await response.json();
  const signedUrl = data?.signedURL || data?.signedUrl || "";
  if (!signedUrl) throw new Error("Link temporario nao retornado.");
  return signedUrl.startsWith("http") ? signedUrl : `${supabaseUrl}/storage/v1${signedUrl}`;
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
