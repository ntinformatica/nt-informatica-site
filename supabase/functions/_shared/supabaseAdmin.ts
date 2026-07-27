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

function headers(extra: HeadersInit = {}) {
  const key = serviceRoleKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra,
  };
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function supabaseRest(path: string, options: RequestInit = {}) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${supabaseUrl()}/rest/v1${cleanPath}`, {
    ...options,
    headers: headers(options.headers),
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload));
  }

  return payload;
}

export async function supabaseRpc(name: string, args: Record<string, unknown> = {}) {
  return supabaseRest(`/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function getSingle(path: string) {
  const rows = await supabaseRest(path);
  return Array.isArray(rows) ? rows[0] || null : rows;
}

export async function insertEvent(event: Record<string, unknown>) {
  return supabaseRest("/arena_payment_events", {
    method: "POST",
    body: JSON.stringify(event),
  }).catch((error) => {
    const message = String(error?.message || "");
    if (message.includes("duplicate key") || message.includes("arena_payment_events_provider_event_uidx")) return null;
    throw error;
  });
}
