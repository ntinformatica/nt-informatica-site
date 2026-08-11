begin;

alter table public.products
  add column if not exists bling_product_id text,
  add column if not exists bling_synced_at timestamptz,
  add column if not exists bling_sync_status text not null default 'not_sent',
  add column if not exists bling_sync_error text not null default '',
  add column if not exists bling_sync_metadata jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_bling_sync_status_check;

alter table public.products
  add constraint products_bling_sync_status_check
  check (bling_sync_status in ('not_sent', 'dirty', 'syncing', 'synced', 'error', 'unsupported', 'review_required'));

create unique index if not exists products_bling_product_id_uidx
  on public.products(bling_product_id)
  where bling_product_id is not null and btrim(bling_product_id) <> '';

create index if not exists products_bling_sync_status_idx
  on public.products(bling_sync_status);

create index if not exists products_bling_sync_metadata_attempt_idx
  on public.products((bling_sync_metadata->>'syncAttemptId'))
  where bling_sync_status = 'syncing';

commit;
