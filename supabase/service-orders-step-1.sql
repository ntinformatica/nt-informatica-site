begin;

create extension if not exists pgcrypto;

create sequence if not exists public.service_orders_number_seq
  start with 1001
  increment by 1
  minvalue 1001
  no maxvalue
  cache 1;

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  os_number integer unique not null default nextval('public.service_orders_number_seq'::regclass),
  status text not null default 'Recebido',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entry_date date,
  entry_time time,
  customer_name text,
  customer_document text,
  customer_phone text,
  device_brand text,
  device_model text,
  device_color text,
  device_serial_imei text,
  device_password text,
  unlock_pattern text,
  accessories jsonb not null default '{}'::jsonb,
  device_condition jsonb not null default '{}'::jsonb,
  reported_defect text,
  requested_services jsonb not null default '{}'::jsonb,
  analysis_price numeric(12,2),
  service_price numeric(12,2),
  estimated_deadline text,
  customer_notes text,
  internal_notes text,
  authorizations jsonb not null default '{}'::jsonb,
  warranty_days integer not null default 90,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

alter sequence public.service_orders_number_seq owned by public.service_orders.os_number;

alter table public.service_orders
  alter column os_number set default nextval('public.service_orders_number_seq'::regclass),
  alter column status set default 'Recebido',
  alter column accessories set default '{}'::jsonb,
  alter column device_condition set default '{}'::jsonb,
  alter column requested_services set default '{}'::jsonb,
  alter column authorizations set default '{}'::jsonb,
  alter column warranty_days set default 90;

do $$
declare
  v_max_os_number integer;
begin
  select max(os_number)
  into v_max_os_number
  from public.service_orders;

  if v_max_os_number is null then
    perform setval('public.service_orders_number_seq'::regclass, 1001, false);
  else
    perform setval('public.service_orders_number_seq'::regclass, greatest(v_max_os_number, 1001), true);
  end if;
end $$;

create index if not exists service_orders_os_number_idx on public.service_orders (os_number);
create index if not exists service_orders_customer_name_idx on public.service_orders using gin (to_tsvector('simple', coalesce(customer_name, '')));
create index if not exists service_orders_customer_phone_idx on public.service_orders (customer_phone);
create index if not exists service_orders_device_model_idx on public.service_orders using gin (to_tsvector('simple', coalesce(device_model, '')));
create index if not exists service_orders_device_serial_imei_idx on public.service_orders (device_serial_imei);
create index if not exists service_orders_status_idx on public.service_orders (status);
create index if not exists service_orders_created_at_idx on public.service_orders (created_at desc);
create index if not exists service_orders_deleted_at_idx on public.service_orders (deleted_at);

create or replace function public.set_service_order_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists service_orders_audit_fields on public.service_orders;
create trigger service_orders_audit_fields
before insert or update on public.service_orders
for each row
execute function public.set_service_order_audit_fields();

create or replace function public.get_next_service_order_number_preview()
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_value bigint;
  v_is_called boolean;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo necessário para consultar a próxima OS.';
  end if;

  select last_value, is_called
  into v_last_value, v_is_called
  from public.service_orders_number_seq;

  return greatest(
    coalesce((select max(os_number) from public.service_orders), 1000) + 1,
    case
      when v_is_called then v_last_value + 1
      else v_last_value
    end
  )::integer;
end;
$$;

alter table public.service_orders enable row level security;

revoke all on table public.service_orders from anon, authenticated;
revoke all on sequence public.service_orders_number_seq from anon, authenticated;
revoke all on function public.set_service_order_audit_fields() from public;
revoke all on function public.get_next_service_order_number_preview() from public;

grant select, insert, update on table public.service_orders to authenticated;
grant usage, select on sequence public.service_orders_number_seq to authenticated;
grant execute on function public.get_next_service_order_number_preview() to authenticated, service_role;
grant all privileges on table public.service_orders to service_role;
grant all privileges on sequence public.service_orders_number_seq to service_role;
grant execute on function public.set_service_order_audit_fields() to service_role;

drop policy if exists service_orders_admin_select on public.service_orders;
drop policy if exists service_orders_admin_insert on public.service_orders;
drop policy if exists service_orders_admin_update on public.service_orders;
drop policy if exists service_orders_admin_delete on public.service_orders;

create policy service_orders_admin_select
on public.service_orders
for select
to authenticated
using (public.is_admin());

create policy service_orders_admin_insert
on public.service_orders
for insert
to authenticated
with check (public.is_admin());

create policy service_orders_admin_update
on public.service_orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

commit;
