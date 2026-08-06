begin;

create extension if not exists pgcrypto;

alter table public.store_orders
  add column if not exists fiscal_status text not null default 'pending',
  add column if not exists fiscal_notes text not null default '';

alter table public.store_orders
  drop constraint if exists store_orders_fiscal_status_check;

alter table public.store_orders
  add constraint store_orders_fiscal_status_check
  check (fiscal_status in ('pending', 'issued', 'cancelled', 'error'));

create table if not exists public.order_billing_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete restrict,
  customer_name text not null default '',
  customer_document text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  postal_code text not null default '',
  street text not null default '',
  number text not null default '',
  complement text not null default '',
  district text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default 'Brasil',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_billing_snapshots_order_uidx unique (order_id),
  constraint order_billing_snapshots_customer_document_check check (customer_document = '' or customer_document ~ '^[0-9]{11}$'),
  constraint order_billing_snapshots_postal_code_check check (postal_code = '' or postal_code ~ '^[0-9]{8}$'),
  constraint order_billing_snapshots_state_check check (state = '' or state ~ '^[A-Z]{2}$')
);

create table if not exists public.order_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete restrict,
  status text not null default 'issued',
  invoice_number text not null default '',
  invoice_series text not null default '',
  access_key text not null,
  issued_at timestamptz,
  xml_storage_path text not null default '',
  pdf_storage_path text not null default '',
  xml_original_name text not null default '',
  pdf_original_name text not null default '',
  xml_mime_type text not null default '',
  pdf_mime_type text not null default '',
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_invoices_order_uidx unique (order_id),
  constraint order_invoices_access_key_uidx unique (access_key),
  constraint order_invoices_status_check check (status in ('issued', 'cancelled', 'error')),
  constraint order_invoices_access_key_check check (access_key ~ '^[0-9]{44}$')
);

drop trigger if exists order_billing_snapshots_set_updated_at on public.order_billing_snapshots;
create trigger order_billing_snapshots_set_updated_at
before update on public.order_billing_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists order_invoices_set_updated_at on public.order_invoices;
create trigger order_invoices_set_updated_at
before update on public.order_invoices
for each row execute function public.set_updated_at();

create index if not exists store_orders_fiscal_status_idx on public.store_orders(fiscal_status);
create index if not exists order_billing_snapshots_order_id_idx on public.order_billing_snapshots(order_id);
create index if not exists order_invoices_order_id_idx on public.order_invoices(order_id);
create index if not exists order_invoices_status_idx on public.order_invoices(status);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-invoices',
  'store-invoices',
  false,
  10485760,
  array['application/pdf', 'application/xml', 'text/xml']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.order_billing_snapshots enable row level security;
alter table public.order_invoices enable row level security;

revoke all on table public.order_billing_snapshots, public.order_invoices from anon, authenticated;
grant all privileges on table public.order_billing_snapshots, public.order_invoices to service_role;
grant select on table public.order_billing_snapshots, public.order_invoices to authenticated;
grant insert, update on table public.order_invoices to authenticated;

drop policy if exists order_billing_snapshots_customer_select on public.order_billing_snapshots;
create policy order_billing_snapshots_customer_select
on public.order_billing_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders own_order
    where own_order.id = order_billing_snapshots.order_id
      and lower(own_order.customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

drop policy if exists order_billing_snapshots_admin_select on public.order_billing_snapshots;
create policy order_billing_snapshots_admin_select
on public.order_billing_snapshots
for select
to authenticated
using (coalesce(public.is_admin(), false));

drop policy if exists order_invoices_customer_select on public.order_invoices;
create policy order_invoices_customer_select
on public.order_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders own_order
    where own_order.id = order_invoices.order_id
      and lower(own_order.customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

drop policy if exists order_invoices_admin_all on public.order_invoices;
create policy order_invoices_admin_all
on public.order_invoices
for all
to authenticated
using (coalesce(public.is_admin(), false))
with check (coalesce(public.is_admin(), false));

drop policy if exists store_invoice_files_admin_all on storage.objects;
create policy store_invoice_files_admin_all
on storage.objects
for all
to authenticated
using (bucket_id = 'store-invoices' and coalesce(public.is_admin(), false))
with check (bucket_id = 'store-invoices' and coalesce(public.is_admin(), false));

drop policy if exists store_invoice_files_customer_read on storage.objects;
create policy store_invoice_files_customer_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'store-invoices'
  and exists (
    select 1
    from public.order_invoices invoice
    join public.store_orders own_order on own_order.id = invoice.order_id
    where (
      storage.objects.name = invoice.xml_storage_path
      or storage.objects.name = invoice.pdf_storage_path
    )
      and lower(own_order.customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

commit;
