begin;

alter table public.store_orders
  add column if not exists bling_order_id text,
  add column if not exists bling_order_number text,
  add column if not exists bling_synced_at timestamptz,
  add column if not exists bling_sync_status text not null default 'not_sent',
  add column if not exists bling_sync_error text not null default '',
  add column if not exists bling_sync_metadata jsonb not null default '{}'::jsonb;

alter table public.store_orders
  drop constraint if exists store_orders_bling_sync_status_check;

alter table public.store_orders
  add constraint store_orders_bling_sync_status_check
  check (bling_sync_status in ('not_sent', 'syncing', 'synced', 'error'));

create unique index if not exists store_orders_bling_order_id_uidx
  on public.store_orders(bling_order_id)
  where bling_order_id is not null and btrim(bling_order_id) <> '';

create index if not exists store_orders_bling_sync_status_idx
  on public.store_orders(bling_sync_status);

commit;
