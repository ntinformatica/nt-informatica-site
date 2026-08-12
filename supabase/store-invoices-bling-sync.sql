begin;

alter table public.order_invoices
  add column if not exists provider text not null default 'manual',
  add column if not exists bling_invoice_id text,
  add column if not exists provider_status text not null default '',
  add column if not exists authorized_at timestamptz;

alter table public.order_invoices
  alter column access_key drop not null,
  alter column access_key drop default;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'order_invoices_status_check'
      and conrelid = 'public.order_invoices'::regclass
  ) then
    alter table public.order_invoices
      drop constraint order_invoices_status_check;
  end if;
end $$;

alter table public.order_invoices
  add constraint order_invoices_status_check
  check (status in ('pending', 'issued', 'authorized', 'rejected', 'cancelled', 'error'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'order_invoices_access_key_check'
      and conrelid = 'public.order_invoices'::regclass
  ) then
    alter table public.order_invoices
      drop constraint order_invoices_access_key_check;
  end if;
end $$;

alter table public.order_invoices
  add constraint order_invoices_access_key_check
  check (access_key is null or access_key = '' or access_key ~ '^[0-9]{44}$');

create unique index if not exists order_invoices_bling_invoice_uidx
on public.order_invoices(provider, bling_invoice_id)
where provider = 'bling' and bling_invoice_id is not null and bling_invoice_id <> '';

create index if not exists order_invoices_provider_status_idx
on public.order_invoices(provider, status);

commit;
