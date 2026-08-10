begin;

create or replace function public.acquire_bling_token_refresh_lock(
  p_connection_key text,
  p_refresh_attempt_id text,
  p_stale_after interval default interval '2 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection public.bling_connections%rowtype;
begin
  if nullif(btrim(coalesce(p_connection_key, '')), '') is null then
    raise exception 'connection_key obrigatorio';
  end if;

  if nullif(btrim(coalesce(p_refresh_attempt_id, '')), '') is null then
    raise exception 'refresh_attempt_id obrigatorio';
  end if;

  update public.bling_connections
  set
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'tokenRefresh',
      jsonb_build_object(
        'refreshAttemptId', p_refresh_attempt_id,
        'lockedAt', now()
      )
    ),
    updated_at = now()
  where connection_key = p_connection_key
    and status = 'active'
    and (
      metadata->'tokenRefresh' is null
      or nullif(metadata #>> '{tokenRefresh,lockedAt}', '') is null
      or (metadata #>> '{tokenRefresh,lockedAt}')::timestamptz <= now() - p_stale_after
    )
  returning * into v_connection;

  if v_connection.id is null then
    return jsonb_build_object('acquired', false);
  end if;

  return jsonb_build_object(
    'acquired', true,
    'connection_key', v_connection.connection_key
  );
end;
$$;

create or replace function public.save_bling_refreshed_tokens_if_lock(
  p_connection_key text,
  p_refresh_attempt_id text,
  p_access_token_encrypted text,
  p_refresh_token_encrypted text,
  p_token_type text,
  p_scopes text[],
  p_access_token_expires_at timestamptz,
  p_refresh_token_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection public.bling_connections%rowtype;
begin
  if nullif(btrim(coalesce(p_connection_key, '')), '') is null then
    raise exception 'connection_key obrigatorio';
  end if;

  if nullif(btrim(coalesce(p_refresh_attempt_id, '')), '') is null then
    raise exception 'refresh_attempt_id obrigatorio';
  end if;

  update public.bling_connections
  set
    status = 'active',
    access_token_encrypted = p_access_token_encrypted,
    refresh_token_encrypted = p_refresh_token_encrypted,
    token_type = coalesce(nullif(btrim(p_token_type), ''), 'Bearer'),
    scopes = coalesce(p_scopes, array[]::text[]),
    access_token_expires_at = p_access_token_expires_at,
    refresh_token_expires_at = p_refresh_token_expires_at,
    last_refreshed_at = now(),
    revoked_at = null,
    metadata = (coalesce(metadata, '{}'::jsonb) - 'tokenRefresh') || jsonb_build_object(
      'lastRefreshAttemptId', p_refresh_attempt_id,
      'lastRefreshCompletedAt', now()
    ),
    updated_at = now()
  where connection_key = p_connection_key
    and status = 'active'
    and metadata #>> '{tokenRefresh,refreshAttemptId}' = p_refresh_attempt_id
  returning * into v_connection;

  if v_connection.id is null then
    return jsonb_build_object('saved', false);
  end if;

  return jsonb_build_object('saved', true);
end;
$$;

create or replace function public.clear_bling_token_refresh_lock(
  p_connection_key text,
  p_refresh_attempt_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection public.bling_connections%rowtype;
begin
  if nullif(btrim(coalesce(p_connection_key, '')), '') is null then
    raise exception 'connection_key obrigatorio';
  end if;

  if nullif(btrim(coalesce(p_refresh_attempt_id, '')), '') is null then
    raise exception 'refresh_attempt_id obrigatorio';
  end if;

  update public.bling_connections
  set
    metadata = (coalesce(metadata, '{}'::jsonb) - 'tokenRefresh') || jsonb_build_object(
      'lastRefreshAttemptId', p_refresh_attempt_id,
      'lastRefreshClearedAt', now()
    ),
    updated_at = now()
  where connection_key = p_connection_key
    and metadata #>> '{tokenRefresh,refreshAttemptId}' = p_refresh_attempt_id
  returning * into v_connection;

  return jsonb_build_object('cleared', v_connection.id is not null);
end;
$$;

revoke all on function public.acquire_bling_token_refresh_lock(text, text, interval) from public;
revoke all on function public.acquire_bling_token_refresh_lock(text, text, interval) from anon;
revoke all on function public.acquire_bling_token_refresh_lock(text, text, interval) from authenticated;

revoke all on function public.save_bling_refreshed_tokens_if_lock(text, text, text, text, text, text[], timestamptz, timestamptz) from public;
revoke all on function public.save_bling_refreshed_tokens_if_lock(text, text, text, text, text, text[], timestamptz, timestamptz) from anon;
revoke all on function public.save_bling_refreshed_tokens_if_lock(text, text, text, text, text, text[], timestamptz, timestamptz) from authenticated;

revoke all on function public.clear_bling_token_refresh_lock(text, text) from public;
revoke all on function public.clear_bling_token_refresh_lock(text, text) from anon;
revoke all on function public.clear_bling_token_refresh_lock(text, text) from authenticated;

grant execute on function public.acquire_bling_token_refresh_lock(text, text, interval) to service_role;
grant execute on function public.save_bling_refreshed_tokens_if_lock(text, text, text, text, text, text[], timestamptz, timestamptz) to service_role;
grant execute on function public.clear_bling_token_refresh_lock(text, text) to service_role;

commit;
