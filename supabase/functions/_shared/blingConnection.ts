import {
  BlingHttpError,
  blingRequest,
  decryptBlingToken,
  encryptBlingToken,
  refreshBlingAccessToken,
} from "./bling.ts";
import { getSingle, supabaseRpc } from "./supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

export type BlingConnection = {
  id?: string;
  status?: string;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  access_token_expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  token_type?: string | null;
  scopes?: string[] | null;
  metadata?: JsonObject | null;
};

export type BlingAccessContext = {
  connection: BlingConnection;
  accessToken: string;
};

const CONNECTION_KEY = "nt-main";
const REFRESH_LOCK_RETRY_MS = 900;
const REFRESH_LOCK_RETRIES = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenExpiresSoon(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 60_000;
}

export async function loadActiveBlingConnection() {
  const connection = await getSingle(
    `/bling_connections?connection_key=eq.${encodeURIComponent(CONNECTION_KEY)}&select=id,status,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,refresh_token_expires_at,token_type,scopes,metadata&limit=1`,
  ) as BlingConnection | null;

  if (!connection) throw new Error("bling_not_connected");
  if (connection.status !== "active") throw new Error("bling_not_active");
  if (!connection.access_token_encrypted) throw new Error("bling_access_token_missing");
  return connection;
}

async function saveRefreshedConnectionTokens(
  connection: BlingConnection,
  refreshAttemptId: string,
  tokenResponse: Awaited<ReturnType<typeof refreshBlingAccessToken>>,
) {
  const accessTokenEncrypted = await encryptBlingToken(tokenResponse.accessToken);
  const refreshTokenEncrypted = await encryptBlingToken(tokenResponse.refreshToken);
  const saved = await supabaseRpc("save_bling_refreshed_tokens_if_lock", {
    p_connection_key: CONNECTION_KEY,
    p_refresh_attempt_id: refreshAttemptId,
    p_access_token_encrypted: accessTokenEncrypted,
    p_refresh_token_encrypted: refreshTokenEncrypted,
    p_token_type: tokenResponse.tokenType || "Bearer",
    p_scopes: tokenResponse.scopes,
    p_access_token_expires_at: tokenResponse.accessTokenExpiresAt,
    p_refresh_token_expires_at: tokenResponse.refreshTokenExpiresAt || connection.refresh_token_expires_at || null,
  }) as JsonObject | null;

  if (!saved || saved.saved !== true) {
    throw new Error("bling_refresh_lock_lost");
  }
}

async function refreshConnectionToken(connection: BlingConnection, forceRefresh = false) {
  if (!connection.refresh_token_encrypted) throw new Error("bling_refresh_token_missing");

  const latest = await loadActiveBlingConnection();
  if (!forceRefresh && !tokenExpiresSoon(latest.access_token_expires_at)) {
    return decryptBlingToken(latest.access_token_encrypted || "");
  }

  if (
    forceRefresh
    && latest.access_token_encrypted
    && connection.access_token_encrypted
    && latest.access_token_encrypted !== connection.access_token_encrypted
  ) {
    return decryptBlingToken(latest.access_token_encrypted);
  }

  const refreshAttemptId = crypto.randomUUID();
  const lockResult = await supabaseRpc("acquire_bling_token_refresh_lock", {
    p_connection_key: CONNECTION_KEY,
    p_refresh_attempt_id: refreshAttemptId,
  }) as JsonObject | null;

  if (!lockResult || lockResult.acquired !== true) {
    throw new Error("bling_refresh_in_progress");
  }

  try {
    const refreshToken = await decryptBlingToken(latest.refresh_token_encrypted || "");
    const tokenResponse = await refreshBlingAccessToken(refreshToken);
    await saveRefreshedConnectionTokens(latest, refreshAttemptId, tokenResponse);
    return tokenResponse.accessToken;
  } catch (error) {
    await supabaseRpc("clear_bling_token_refresh_lock", {
      p_connection_key: CONNECTION_KEY,
      p_refresh_attempt_id: refreshAttemptId,
    }).catch(() => null);
    throw error;
  }
}

export async function accessTokenForBlingConnection(connection: BlingConnection, forceRefresh = false) {
  if (forceRefresh || tokenExpiresSoon(connection.access_token_expires_at)) {
    for (let attempt = 0; attempt <= REFRESH_LOCK_RETRIES; attempt += 1) {
      try {
        return await refreshConnectionToken(connection, forceRefresh);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message !== "bling_refresh_in_progress" || attempt === REFRESH_LOCK_RETRIES) throw error;
        await sleep(REFRESH_LOCK_RETRY_MS);
        const latest = await loadActiveBlingConnection();
        if (
          latest.access_token_encrypted
          && (
            !tokenExpiresSoon(latest.access_token_expires_at)
            || latest.access_token_encrypted !== connection.access_token_encrypted
          )
        ) {
          return decryptBlingToken(latest.access_token_encrypted || "");
        }
      }
    }
  }
  return decryptBlingToken(connection.access_token_encrypted || "");
}

export async function blingRequestWithTokenRefresh<T = unknown>(
  context: BlingAccessContext,
  path: string,
  options: Parameters<typeof blingRequest<T>>[2] = {},
) {
  try {
    return await blingRequest<T>(context.accessToken, path, options);
  } catch (error) {
    if (error instanceof BlingHttpError && error.status === 401 && context.connection.refresh_token_encrypted) {
      context.accessToken = await accessTokenForBlingConnection(context.connection, true);
      return blingRequest<T>(context.accessToken, path, options);
    }
    throw error;
  }
}
