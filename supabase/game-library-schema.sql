create table if not exists public.game_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  cover_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_library_name_idx on public.game_library(name);
create index if not exists game_library_slug_idx on public.game_library(slug);

drop trigger if exists game_library_set_updated_at on public.game_library;
create trigger game_library_set_updated_at
before update on public.game_library
for each row execute function public.set_updated_at();

alter table public.game_library enable row level security;

drop policy if exists game_library_public_select on public.game_library;
create policy game_library_public_select
  on public.game_library
  for select
  to anon, authenticated
  using (true);

drop policy if exists game_library_admin_insert on public.game_library;
create policy game_library_admin_insert
  on public.game_library
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists game_library_admin_update on public.game_library;
create policy game_library_admin_update
  on public.game_library
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists game_library_admin_delete on public.game_library;
create policy game_library_admin_delete
  on public.game_library
  for delete
  to authenticated
  using (public.is_admin());
