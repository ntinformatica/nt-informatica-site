begin;

alter table public.products
  add column if not exists bling_stock_synced_at timestamptz,
  add column if not exists bling_stock_sync_status text not null default 'not_synced',
  add column if not exists bling_stock_sync_error text not null default '',
  add column if not exists bling_stock_sync_metadata jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_bling_stock_sync_status_check;

alter table public.products
  add constraint products_bling_stock_sync_status_check
  check (bling_stock_sync_status in ('not_synced', 'syncing', 'synced', 'error'));

create index if not exists products_bling_stock_sync_status_idx
  on public.products(bling_stock_sync_status);

create index if not exists products_bling_stock_sync_metadata_attempt_idx
  on public.products((bling_stock_sync_metadata->>'syncAttemptId'))
  where bling_stock_sync_status = 'syncing';

commit;
