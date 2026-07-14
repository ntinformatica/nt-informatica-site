create table if not exists public.assembled_pcs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text default '',
  short_description text default '',
  full_description text default '',
  processor text default '',
  motherboard text default '',
  memory text default '',
  storage text default '',
  graphics_card text default '',
  power_supply text default '',
  case_model text default '',
  cooling text default '',
  operating_system text default '',
  price numeric(12, 2),
  promo_price numeric(12, 2),
  stock integer not null default 0,
  warranty text default '',
  main_image text default '',
  images text[] not null default '{}',
  featured boolean not null default false,
  published boolean not null default false,
  internal_notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assembled_pcs
  add column if not exists pc_type text not null default 'gamer_entrada',
  add column if not exists processor_cooler text not null default '',
  add column if not exists hard_drive text not null default '',
  add column if not exists fans text not null default '',
  add column if not exists wifi boolean not null default false,
  add column if not exists bluetooth boolean not null default false,
  add column if not exists rgb boolean not null default false,
  add column if not exists office_included boolean not null default false,
  add column if not exists windows_included boolean not null default false,
  add column if not exists windows_version text not null default '',
  add column if not exists warranty_months integer not null default 3,
  add column if not exists target_uses text[] not null default '{}',
  add column if not exists recommended_games text[] not null default '{}',
  add column if not exists quality_checks text[] not null default '{}',
  add column if not exists internal_code text not null default '',
  add column if not exists status text not null default 'rascunho',
  add column if not exists published_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.assembled_pcs
set
  status = case
    when published = true and stock > 0 then 'publicado'
    when published = true and stock <= 0 then 'esgotado'
    when status in ('rascunho', 'publicado', 'esgotado', 'desativado') then status
    else 'rascunho'
  end,
  pc_type = case
    when pc_type in ('office', 'estudos', 'gamer_entrada', 'gamer_intermediario', 'gamer_avancado', 'streaming', 'edicao', 'high_end') then pc_type
    when pc_type = 'gamer' then 'gamer_entrada'
    when pc_type is null or pc_type = '' then 'gamer_entrada'
    else 'gamer_entrada'
  end,
  warranty_months = case
    when warranty_months is null or warranty_months < 0 then 3
    else warranty_months
  end
where true;

alter table public.assembled_pcs
  drop constraint if exists assembled_pcs_pc_type_check;

alter table public.assembled_pcs
  add constraint assembled_pcs_pc_type_check
  check (pc_type in ('office', 'estudos', 'gamer_entrada', 'gamer_intermediario', 'gamer_avancado', 'streaming', 'edicao', 'high_end'));

alter table public.assembled_pcs
  drop constraint if exists assembled_pcs_status_check;

alter table public.assembled_pcs
  add constraint assembled_pcs_status_check
  check (status in ('rascunho', 'publicado', 'esgotado', 'desativado'));

create index if not exists assembled_pcs_slug_idx on public.assembled_pcs(slug);
create index if not exists assembled_pcs_category_idx on public.assembled_pcs(category);
create index if not exists assembled_pcs_featured_idx on public.assembled_pcs(featured);
create index if not exists assembled_pcs_published_idx on public.assembled_pcs(published);
create index if not exists assembled_pcs_stock_idx on public.assembled_pcs(stock);
create index if not exists assembled_pcs_pc_type_idx on public.assembled_pcs(pc_type);
create index if not exists assembled_pcs_status_idx on public.assembled_pcs(status);
create index if not exists assembled_pcs_internal_code_idx on public.assembled_pcs(internal_code);
create index if not exists assembled_pcs_published_at_idx on public.assembled_pcs(published_at desc);

drop trigger if exists assembled_pcs_set_updated_at on public.assembled_pcs;
create trigger assembled_pcs_set_updated_at
before update on public.assembled_pcs
for each row execute function public.set_updated_at();
