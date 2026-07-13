create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variation_id uuid references public.product_variations(id) on delete set null,
  type text not null check (type in ('entrada', 'saída', 'ajuste')),
  quantity integer not null,
  previous_stock integer not null default 0,
  new_stock integer not null default 0,
  reason text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_id_idx
  on public.stock_movements(product_id);

create index if not exists stock_movements_variation_id_idx
  on public.stock_movements(variation_id);

create index if not exists stock_movements_created_at_idx
  on public.stock_movements(created_at desc);
