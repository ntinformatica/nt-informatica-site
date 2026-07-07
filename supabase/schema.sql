create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  sort_order integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  brand text default '',
  model text default '',
  short_description text default '',
  full_description text default '',
  price numeric(12, 2),
  promo_price numeric(12, 2),
  status text not null default 'rascunho' check (status in ('disponível', 'esgotado', 'sob encomenda', 'rascunho')),
  stock integer not null default 0,
  featured boolean not null default false,
  sku text default '',
  warranty text default '',
  images text[] not null default '{}',
  internal_notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  value text not null,
  price numeric(12, 2),
  promo_price numeric(12, 2),
  stock integer not null default 0,
  sku text default '',
  images text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_slug_idx on public.categories(slug);
create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_featured_idx on public.products(featured);
create index if not exists product_variations_product_id_idx on public.product_variations(product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists product_variations_set_updated_at on public.product_variations;
create trigger product_variations_set_updated_at
before update on public.product_variations
for each row execute function public.set_updated_at();

insert into public.categories (name, slug, sort_order)
values
  ('Monitores', 'monitores', 1),
  ('Teclados', 'teclados', 2),
  ('Mouses', 'mouses', 3),
  ('Headsets', 'headsets', 4),
  ('Gabinetes', 'gabinetes', 5),
  ('SSDs', 'ssds', 6),
  ('Memórias RAM', 'memorias-ram', 7),
  ('Fontes', 'fontes', 8),
  ('Controles', 'controles', 9),
  ('Carregadores e cabos', 'carregadores-e-cabos', 10),
  ('Kits e combos', 'kits-e-combos', 11),
  ('Acessórios gamer', 'acessorios-gamer', 12)
on conflict (slug) do nothing;
