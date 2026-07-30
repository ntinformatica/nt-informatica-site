begin;

create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  cpf text not null default '',
  birth_date date,
  phone text not null default '',
  phone_normalized text not null default '',
  secondary_phone text not null default '',
  secondary_phone_normalized text not null default '',
  avatar_url text not null default '',
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  last_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_cpf_digits_check check (cpf = '' or cpf ~ '^[0-9]{11}$'),
  constraint customer_profiles_phone_digits_check check (phone_normalized = '' or phone_normalized ~ '^[0-9]{10,11}$'),
  constraint customer_profiles_secondary_phone_digits_check check (secondary_phone_normalized = '' or secondary_phone_normalized ~ '^[0-9]{10,11}$')
);

create unique index if not exists customer_profiles_cpf_uidx
  on public.customer_profiles(cpf)
  where cpf <> '';

create index if not exists customer_profiles_phone_idx
  on public.customer_profiles(phone_normalized)
  where phone_normalized <> '';

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(id) on delete cascade,
  label text not null default 'Principal',
  cep text not null default '',
  street text not null default '',
  number text not null default '',
  complement text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default 'Brasil',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_cep_check check (cep = '' or cep ~ '^[0-9]{8}$'),
  constraint customer_addresses_state_check check (state = '' or state ~ '^[A-Z]{2}$')
);

create index if not exists customer_addresses_user_id_idx
  on public.customer_addresses(user_id);

create unique index if not exists customer_addresses_one_default_uidx
  on public.customer_addresses(user_id)
  where is_default;

create or replace function public.set_customer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_profiles_set_updated_at on public.customer_profiles;
create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute function public.set_customer_updated_at();

drop trigger if exists customer_addresses_set_updated_at on public.customer_addresses;
create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_customer_updated_at();

create or replace function public.handle_new_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.customer_profiles (
    id,
    full_name,
    cpf,
    birth_date,
    phone,
    phone_normalized,
    terms_accepted_at,
    privacy_accepted_at,
    metadata
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    regexp_replace(coalesce(new.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'),
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    regexp_replace(coalesce(new.raw_user_meta_data->>'phone_normalized', new.raw_user_meta_data->>'phone', ''), '\D', '', 'g'),
    case when coalesce((new.raw_user_meta_data->>'terms_accepted')::boolean, false) then now() else null end,
    case when coalesce((new.raw_user_meta_data->>'privacy_accepted')::boolean, false) then now() else null end,
    jsonb_build_object('source', 'supabase_auth_signup')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    cpf = excluded.cpf,
    birth_date = excluded.birth_date,
    phone = excluded.phone,
    phone_normalized = excluded.phone_normalized,
    terms_accepted_at = coalesce(public.customer_profiles.terms_accepted_at, excluded.terms_accepted_at),
    privacy_accepted_at = coalesce(public.customer_profiles.privacy_accepted_at, excluded.privacy_accepted_at),
    metadata = public.customer_profiles.metadata || excluded.metadata;

  if new.raw_user_meta_data ? 'address' then
    insert into public.customer_addresses (
      user_id,
      label,
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      country,
      is_default
    )
    values (
      new.id,
      coalesce(new.raw_user_meta_data->'address'->>'label', 'Principal'),
      regexp_replace(coalesce(new.raw_user_meta_data->'address'->>'cep', ''), '\D', '', 'g'),
      coalesce(new.raw_user_meta_data->'address'->>'street', ''),
      coalesce(new.raw_user_meta_data->'address'->>'number', ''),
      coalesce(new.raw_user_meta_data->'address'->>'complement', ''),
      coalesce(new.raw_user_meta_data->'address'->>'neighborhood', ''),
      coalesce(new.raw_user_meta_data->'address'->>'city', ''),
      upper(left(coalesce(new.raw_user_meta_data->'address'->>'state', ''), 2)),
      coalesce(nullif(new.raw_user_meta_data->'address'->>'country', ''), 'Brasil'),
      true
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer_profile on auth.users;
create trigger on_auth_user_created_customer_profile
after insert on auth.users
for each row execute function public.handle_new_customer_profile();

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;

grant select, insert, update on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;

drop policy if exists customer_profiles_self_select on public.customer_profiles;
create policy customer_profiles_self_select
on public.customer_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists customer_profiles_self_insert on public.customer_profiles;
create policy customer_profiles_self_insert
on public.customer_profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists customer_profiles_self_update on public.customer_profiles;
create policy customer_profiles_self_update
on public.customer_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists customer_profiles_admin_all on public.customer_profiles;
create policy customer_profiles_admin_all
on public.customer_profiles
for all
to authenticated
using (coalesce(public.is_admin(), false))
with check (coalesce(public.is_admin(), false));

drop policy if exists customer_addresses_self_select on public.customer_addresses;
create policy customer_addresses_self_select
on public.customer_addresses
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists customer_addresses_self_insert on public.customer_addresses;
create policy customer_addresses_self_insert
on public.customer_addresses
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists customer_addresses_self_update on public.customer_addresses;
create policy customer_addresses_self_update
on public.customer_addresses
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists customer_addresses_self_delete on public.customer_addresses;
create policy customer_addresses_self_delete
on public.customer_addresses
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists customer_addresses_admin_all on public.customer_addresses;
create policy customer_addresses_admin_all
on public.customer_addresses
for all
to authenticated
using (coalesce(public.is_admin(), false))
with check (coalesce(public.is_admin(), false));

drop policy if exists store_orders_customer_select on public.store_orders;
create policy store_orders_customer_select
on public.store_orders
for select
to authenticated
using (
  lower(customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
);

drop policy if exists store_order_items_customer_select on public.store_order_items;
create policy store_order_items_customer_select
on public.store_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders own_order
    where own_order.id = store_order_items.order_id
      and lower(own_order.customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

drop policy if exists store_payments_customer_select on public.store_payments;
create policy store_payments_customer_select
on public.store_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders own_order
    where own_order.id = store_payments.order_id
      and lower(own_order.customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

commit;
