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

create index if not exists assembled_pcs_slug_idx on public.assembled_pcs(slug);
create index if not exists assembled_pcs_category_idx on public.assembled_pcs(category);
create index if not exists assembled_pcs_featured_idx on public.assembled_pcs(featured);
create index if not exists assembled_pcs_published_idx on public.assembled_pcs(published);
create index if not exists assembled_pcs_stock_idx on public.assembled_pcs(stock);

drop trigger if exists assembled_pcs_set_updated_at on public.assembled_pcs;
create trigger assembled_pcs_set_updated_at
before update on public.assembled_pcs
for each row execute function public.set_updated_at();
