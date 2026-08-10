import {
  BlingHttpError,
  encryptBlingToken,
  exchangeBlingAuthorizationCode,
  hashBlingOAuthState,
  validateBlingConfig,
} from "../_shared/bling.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail } from "../_shared/responses.ts";
import { supabaseRest } from "../_shared/supabaseAdmin.ts";

type OAuthStateRow = {
  id: string;
  admin_user_id: string | null;
  expires_at: string;
  consumed_at: string | null;
};

const CONNECTION_KEY = "nt-main";
const ADMIN_RETURN_PATH = "/admin/configuracoes";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function siteUrl() {
  return String(Deno.env.get("SITE_URL") || "https://nt-informatica-site.vercel.app").replace(/\/+$/, "");
}

function redirectUrl(status: "connected" | "error", reason = "") {
  const url = new URL(`${siteUrl()}${ADMIN_RETURN_PATH}`);
  url.searchParams.set("bling", status);
  if (reason) url.searchParams.set("reason", reason);
  return url.toString();
}

function redirect(status: "connected" | "error", reason = "") {
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl(status, reason),
      "Cache-Control": "no-store",
    },
  });
}

function reasonFromBlingError(error: string) {
  const normalized = cleanText(error).toLowerCase();
  if (!normalized) return "bling_error";
  if (normalized.includes("access_denied")) return "access_denied";
  if (normalized.includes("invalid_request")) return "invalid_request";
  if (normalized.includes("invalid_scope")) return "invalid_scope";
  if (normalized.includes("server_error")) return "bling_server_error";
  return "bling_error";
}

function reasonFromUnknownError(error: unknown) {
  if (error instanceof BlingHttpError) {
    if (error.status === 400 || error.status === 401 || error.status === 403) return "token_exchange_rejected";
    if (error.temporary) return "token_exchange_temporary";
    return "token_exchange_failed";
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("Secrets Bling ausentes")) return "missing_bling_config";
  if (message.includes("BLING_TOKEN_ENCRYPTION_KEY")) return "invalid_encryption_key";
  if (message.includes("Resposta Bling")) return "invalid_token_response";
  return "internal_error";
}

function sanitizeError(error: unknown) {
  if (error instanceof BlingHttpError) {
    return {
      name: error.name,
      status: error.status,
      temporary: error.temporary,
    };
  }
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Erro desconhecido.",
  };
}

function fromRows(rows: unknown): OAuthStateRow | null {
  return Array.isArray(rows) ? rows[0] as OAuthStateRow || null : null;
}

async function consumeOAuthState(stateHash: string, now: string) {
  const rows = await supabaseRest(
    `/bling_oauth_states`
    + `?state_hash=eq.${encodeURIComponent(stateHash)}`
    + "&consumed_at=is.null"
    + `&expires_at=gt.${encodeURIComponent(now)}`
    + "&select=id,admin_user_id,expires_at,consumed_at",
    {
      method: "PATCH",
      body: JSON.stringify({ consumed_at: now }),
    },
  );
  return fromRows(rows);
}

async function saveBlingConnection(params: {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenType: string;
  scopes: string[];
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  connectedBy: string | null;
  connectedAt: string;
}) {
  return supabaseRest(
    "/bling_connections?on_conflict=connection_key&select=id,connection_key,status,connected_at,last_refreshed_at",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        connection_key: CONNECTION_KEY,
        status: "active",
        access_token_encrypted: params.accessTokenEncrypted,
        refresh_token_encrypted: params.refreshTokenEncrypted,
        token_type: params.tokenType || "Bearer",
        scopes: params.scopes,
        access_token_expires_at: params.accessTokenExpiresAt,
        refresh_token_expires_at: params.refreshTokenExpiresAt,
        connected_by: params.connectedBy,
        connected_at: params.connectedAt,
        last_refreshed_at: params.connectedAt,
        revoked_at: null,
        metadata: {
          provider: "bling",
          oauthFlow: "authorization_code",
          callbackProcessedAt: params.connectedAt,
        },
      }),
    },
  );
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      return fail(request, "Metodo nao permitido.", 405);
    }

    validateBlingConfig();

    const url = new URL(request.url);
    const providerError = cleanText(url.searchParams.get("error"));
    if (providerError) {
      console.warn("bling-oauth-callback provider error", {
        error: reasonFromBlingError(providerError),
      });
      return redirect("error", reasonFromBlingError(providerError));
    }

    const code = cleanText(url.searchParams.get("code"));
    const state = cleanText(url.searchParams.get("state"));
    if (!code || !state) return redirect("error", "missing_oauth_params");

    const stateHash = await hashBlingOAuthState(state);
    const now = new Date().toISOString();
    const consumedState = await consumeOAuthState(stateHash, now);
    if (!consumedState) {
      console.warn("bling-oauth-callback invalid state", {
        reason: "invalid_expired_or_consumed_state",
      });
      return redirect("error", "invalid_state");
    }

    let tokenResponse;
    try {
      tokenResponse = await exchangeBlingAuthorizationCode(code);
    } catch (error) {
      console.error("bling-oauth-callback token exchange failed", sanitizeError(error));
      return redirect("error", reasonFromUnknownError(error));
    }

    let accessTokenEncrypted = "";
    let refreshTokenEncrypted = "";
    try {
      [accessTokenEncrypted, refreshTokenEncrypted] = await Promise.all([
        encryptBlingToken(tokenResponse.accessToken),
        encryptBlingToken(tokenResponse.refreshToken),
      ]);
    } catch (error) {
      console.error("bling-oauth-callback token encryption failed", sanitizeError(error));
      return redirect("error", reasonFromUnknownError(error));
    }

    try {
      await saveBlingConnection({
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenType: tokenResponse.tokenType,
        scopes: tokenResponse.scopes,
        accessTokenExpiresAt: tokenResponse.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokenResponse.refreshTokenExpiresAt,
        connectedBy: consumedState.admin_user_id,
        connectedAt: now,
      });
    } catch (error) {
      console.error("bling-oauth-callback connection save failed", sanitizeError(error));
      return redirect("error", "connection_save_failed");
    }

    return redirect("connected");
  } catch (error) {
    console.error("bling-oauth-callback", sanitizeError(error));
    return redirect("error", reasonFromUnknownError(error));
  }
});
