begin;

create extension if not exists pgcrypto;

-- ============================================================
-- BLING OAUTH - STATE CSRF
-- ============================================================
-- Armazena somente hash do state. O valor puro nunca deve ser persistido.

create table if not exists public.bling_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  admin_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bling_oauth_states_state_hash_not_blank_check
    check (btrim(state_hash) <> ''),
  constraint bling_oauth_states_expires_after_created_check
    check (expires_at > created_at),
  constraint bling_oauth_states_consumed_after_created_check
    check (consumed_at is null or consumed_at >= created_at)
);

create index if not exists bling_oauth_states_expires_at_idx
  on public.bling_oauth_states(expires_at);

create index if not exists bling_oauth_states_consumed_at_idx
  on public.bling_oauth_states(consumed_at);

create index if not exists bling_oauth_states_pending_idx
  on public.bling_oauth_states(expires_at, created_at)
  where consumed_at is null;

-- ============================================================
-- BLING OAUTH - CONNECTION
-- ============================================================
-- Tokens devem ser criptografados pelas Edge Functions antes do INSERT/UPDATE.
-- BLING_TOKEN_ENCRYPTION_KEY sera configurada futuramente como Supabase Secret.

create table if not exists public.bling_connections (
  id uuid primary key default gen_random_uuid(),
  connection_key text not null default 'nt-main',
  status text not null default 'reauthorization_required',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_type text not null default 'Bearer',
  scopes text[] not null default array[]::text[],
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  last_refreshed_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bling_connections_connection_key_not_blank_check
    check (btrim(connection_key) <> ''),
  constraint bling_connections_status_check
    check (status in ('active', 'reauthorization_required', 'revoked', 'error')),
  constraint bling_connections_token_type_not_blank_check
    check (btrim(token_type) <> ''),
  constraint bling_connections_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint bling_connections_active_tokens_check
    check (
      status <> 'active'
      or (
        nullif(btrim(coalesce(access_token_encrypted, '')), '') is not null
        and nullif(btrim(coalesce(refresh_token_encrypted, '')), '') is not null
        and access_token_expires_at is not null
      )
    )
);

create unique index if not exists bling_connections_connection_key_uidx
  on public.bling_connections(connection_key);

create index if not exists bling_connections_status_idx
  on public.bling_connections(status);

create index if not exists bling_connections_access_token_expires_at_idx
  on public.bling_connections(access_token_expires_at);

create index if not exists bling_connections_refresh_token_expires_at_idx
  on public.bling_connections(refresh_token_expires_at);

create index if not exists bling_connections_active_idx
  on public.bling_connections(connection_key, access_token_expires_at)
  where status = 'active';

-- ============================================================
-- UPDATED_AT
-- ============================================================
-- Reutiliza public.set_updated_at(), ja existente no projeto.

drop trigger if exists bling_connections_set_updated_at on public.bling_connections;
create trigger bling_connections_set_updated_at
before update on public.bling_connections
for each row execute function public.set_updated_at();

-- ============================================================
-- RLS E PERMISSOES
-- ============================================================
-- Sem policies para anon/authenticated: RLS bloqueia acesso direto do frontend.
-- Edge Functions usam service_role, que bypassa RLS e recebe privilegios explicitos.
-- Status publico/admin sem tokens devera ser exposto futuramente por RPC/view segura.

alter table public.bling_oauth_states enable row level security;
alter table public.bling_connections enable row level security;

revoke all on table public.bling_oauth_states from public;
revoke all on table public.bling_oauth_states from anon;
revoke all on table public.bling_oauth_states from authenticated;

revoke all on table public.bling_connections from public;
revoke all on table public.bling_connections from anon;
revoke all on table public.bling_connections from authenticated;

grant all privileges on table public.bling_oauth_states to service_role;
grant all privileges on table public.bling_connections to service_role;

drop policy if exists bling_oauth_states_no_direct_access on public.bling_oauth_states;
create policy bling_oauth_states_no_direct_access
on public.bling_oauth_states
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists bling_connections_no_direct_access on public.bling_connections;
create policy bling_connections_no_direct_access
on public.bling_connections
for all
to anon, authenticated
using (false)
with check (false);

commit;
