begin;

-- NT Informatica security baseline for Supabase Auth + RLS.
-- Do not execute this migration before reviewing supabase/security-rls-report.md.
-- This script targets the real table names currently used in Supabase.

grant usage on schema public to anon, authenticated, service_role;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

insert into public.admin_users (user_id, email)
values ('2b7a321d-47c8-4056-b285-7941dd8fd00f', 'umjogadordanka@gmail.com')
on conflict (user_id) do update
set email = excluded.email;

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant all privileges on table public.admin_users to service_role;

drop policy if exists admin_users_admin_select on public.admin_users;
drop policy if exists admin_users_admin_insert on public.admin_users;
drop policy if exists admin_users_admin_update on public.admin_users;
drop policy if exists admin_users_admin_delete on public.admin_users;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    exists (
      select 1
      from public.admin_users admin_user
      where admin_user.user_id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.admin_notifications enable row level security;
alter table public.arena_credit_movements enable row level security;
alter table public.arena_customer_subscriptions enable row level security;
alter table public.arena_customers enable row level security;
alter table public.arena_monthly_plans enable row level security;
alter table public.arena_packages enable row level security;
alter table public.arena_reservations enable row level security;
alter table public.arena_settings enable row level security;
alter table public.arena_station_maintenance enable row level security;
alter table public.arena_stations enable row level security;
alter table public.assembled_pcs enable row level security;
alter table public.categories enable row level security;
alter table public.product_variations enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

revoke all on table
  public.admin_notifications,
  public.arena_credit_movements,
  public.arena_customer_subscriptions,
  public.arena_customers,
  public.arena_monthly_plans,
  public.arena_packages,
  public.arena_reservations,
  public.arena_settings,
  public.arena_station_maintenance,
  public.arena_stations,
  public.assembled_pcs,
  public.categories,
  public.product_variations,
  public.products,
  public.stock_movements
from anon, authenticated;

grant select on table
  public.arena_monthly_plans,
  public.arena_packages,
  public.arena_settings,
  public.arena_stations,
  public.assembled_pcs,
  public.categories,
  public.product_variations,
  public.products
to anon, authenticated;

grant select, insert, update, delete on table
  public.admin_notifications,
  public.arena_credit_movements,
  public.arena_customer_subscriptions,
  public.arena_customers,
  public.arena_monthly_plans,
  public.arena_packages,
  public.arena_reservations,
  public.arena_settings,
  public.arena_station_maintenance,
  public.arena_stations,
  public.assembled_pcs,
  public.categories,
  public.product_variations,
  public.products,
  public.stock_movements
to authenticated;

grant all privileges on table
  public.admin_notifications,
  public.arena_credit_movements,
  public.arena_customer_subscriptions,
  public.arena_customers,
  public.arena_monthly_plans,
  public.arena_packages,
  public.arena_reservations,
  public.arena_settings,
  public.arena_station_maintenance,
  public.arena_stations,
  public.assembled_pcs,
  public.categories,
  public.product_variations,
  public.products,
  public.stock_movements
to service_role;

grant usage, select, update on all sequences in schema public to authenticated, service_role;
revoke all on all sequences in schema public from anon;

drop policy if exists categories_public_select_active on public.categories;
create policy categories_public_select_active
  on public.categories
  for select
  to anon, authenticated
  using (active is true);

drop policy if exists categories_admin_select on public.categories;
create policy categories_admin_select on public.categories for select to authenticated using (public.is_admin());
drop policy if exists categories_admin_insert on public.categories;
create policy categories_admin_insert on public.categories for insert to authenticated with check (public.is_admin());
drop policy if exists categories_admin_update on public.categories;
create policy categories_admin_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists categories_admin_delete on public.categories;
create policy categories_admin_delete on public.categories for delete to authenticated using (public.is_admin());

drop policy if exists products_public_select_published on public.products;
create policy products_public_select_published
  on public.products
  for select
  to anon, authenticated
  using (
    coalesce(status, '') not in (
      'rascunho',
      'despublicado',
      'inativo',
      'desativado',
      'draft',
      'unpublished'
    )
  );

drop policy if exists products_admin_select on public.products;
create policy products_admin_select on public.products for select to authenticated using (public.is_admin());
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());

drop policy if exists product_variations_public_select_active on public.product_variations;
create policy product_variations_public_select_active
  on public.product_variations
  for select
  to anon, authenticated
  using (
    active is true
    and coalesce(status, 'ativo') not in ('inativo')
    and exists (
      select 1
      from public.products product
      where product.id = product_variations.product_id
        and coalesce(product.status, '') not in (
          'rascunho',
          'despublicado',
          'inativo',
          'desativado',
          'draft',
          'unpublished'
        )
    )
  );

drop policy if exists product_variations_admin_select on public.product_variations;
create policy product_variations_admin_select on public.product_variations for select to authenticated using (public.is_admin());
drop policy if exists product_variations_admin_insert on public.product_variations;
create policy product_variations_admin_insert on public.product_variations for insert to authenticated with check (public.is_admin());
drop policy if exists product_variations_admin_update on public.product_variations;
create policy product_variations_admin_update on public.product_variations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists product_variations_admin_delete on public.product_variations;
create policy product_variations_admin_delete on public.product_variations for delete to authenticated using (public.is_admin());

drop policy if exists assembled_pcs_public_select_published on public.assembled_pcs;
create policy assembled_pcs_public_select_published
  on public.assembled_pcs
  for select
  to anon, authenticated
  using (
    published is true
    and coalesce(status, '') not in ('rascunho', 'desativado')
  );

drop policy if exists assembled_pcs_admin_select on public.assembled_pcs;
create policy assembled_pcs_admin_select on public.assembled_pcs for select to authenticated using (public.is_admin());
drop policy if exists assembled_pcs_admin_insert on public.assembled_pcs;
create policy assembled_pcs_admin_insert on public.assembled_pcs for insert to authenticated with check (public.is_admin());
drop policy if exists assembled_pcs_admin_update on public.assembled_pcs;
create policy assembled_pcs_admin_update on public.assembled_pcs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists assembled_pcs_admin_delete on public.assembled_pcs;
create policy assembled_pcs_admin_delete on public.assembled_pcs for delete to authenticated using (public.is_admin());

drop policy if exists arena_stations_public_select_available on public.arena_stations;
create policy arena_stations_public_select_available
  on public.arena_stations
  for select
  to anon, authenticated
  using (
    active is true
    and coalesce(availability_status, 'disponivel') not in ('manutencao', 'inativo')
  );

drop policy if exists arena_stations_admin_select on public.arena_stations;
create policy arena_stations_admin_select on public.arena_stations for select to authenticated using (public.is_admin());
drop policy if exists arena_stations_admin_insert on public.arena_stations;
create policy arena_stations_admin_insert on public.arena_stations for insert to authenticated with check (public.is_admin());
drop policy if exists arena_stations_admin_update on public.arena_stations;
create policy arena_stations_admin_update on public.arena_stations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_stations_admin_delete on public.arena_stations;
create policy arena_stations_admin_delete on public.arena_stations for delete to authenticated using (public.is_admin());

drop policy if exists arena_settings_public_select on public.arena_settings;
create policy arena_settings_public_select
  on public.arena_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists arena_settings_admin_select on public.arena_settings;
create policy arena_settings_admin_select on public.arena_settings for select to authenticated using (public.is_admin());
drop policy if exists arena_settings_admin_insert on public.arena_settings;
create policy arena_settings_admin_insert on public.arena_settings for insert to authenticated with check (public.is_admin());
drop policy if exists arena_settings_admin_update on public.arena_settings;
create policy arena_settings_admin_update on public.arena_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_settings_admin_delete on public.arena_settings;
create policy arena_settings_admin_delete on public.arena_settings for delete to authenticated using (public.is_admin());

drop policy if exists arena_packages_public_select_active on public.arena_packages;
create policy arena_packages_public_select_active
  on public.arena_packages
  for select
  to anon, authenticated
  using (active is true);

drop policy if exists arena_packages_admin_select on public.arena_packages;
create policy arena_packages_admin_select on public.arena_packages for select to authenticated using (public.is_admin());
drop policy if exists arena_packages_admin_insert on public.arena_packages;
create policy arena_packages_admin_insert on public.arena_packages for insert to authenticated with check (public.is_admin());
drop policy if exists arena_packages_admin_update on public.arena_packages;
create policy arena_packages_admin_update on public.arena_packages for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_packages_admin_delete on public.arena_packages;
create policy arena_packages_admin_delete on public.arena_packages for delete to authenticated using (public.is_admin());

drop policy if exists arena_monthly_plans_public_select_active on public.arena_monthly_plans;
create policy arena_monthly_plans_public_select_active
  on public.arena_monthly_plans
  for select
  to anon, authenticated
  using (active is true);

drop policy if exists arena_monthly_plans_admin_select on public.arena_monthly_plans;
create policy arena_monthly_plans_admin_select on public.arena_monthly_plans for select to authenticated using (public.is_admin());
drop policy if exists arena_monthly_plans_admin_insert on public.arena_monthly_plans;
create policy arena_monthly_plans_admin_insert on public.arena_monthly_plans for insert to authenticated with check (public.is_admin());
drop policy if exists arena_monthly_plans_admin_update on public.arena_monthly_plans;
create policy arena_monthly_plans_admin_update on public.arena_monthly_plans for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_monthly_plans_admin_delete on public.arena_monthly_plans;
create policy arena_monthly_plans_admin_delete on public.arena_monthly_plans for delete to authenticated using (public.is_admin());

drop policy if exists stock_movements_admin_select on public.stock_movements;
create policy stock_movements_admin_select on public.stock_movements for select to authenticated using (public.is_admin());
drop policy if exists stock_movements_admin_insert on public.stock_movements;
create policy stock_movements_admin_insert on public.stock_movements for insert to authenticated with check (public.is_admin());
drop policy if exists stock_movements_admin_update on public.stock_movements;
create policy stock_movements_admin_update on public.stock_movements for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists stock_movements_admin_delete on public.stock_movements;
create policy stock_movements_admin_delete on public.stock_movements for delete to authenticated using (public.is_admin());

drop policy if exists arena_customers_admin_select on public.arena_customers;
create policy arena_customers_admin_select on public.arena_customers for select to authenticated using (public.is_admin());
drop policy if exists arena_customers_admin_insert on public.arena_customers;
create policy arena_customers_admin_insert on public.arena_customers for insert to authenticated with check (public.is_admin());
drop policy if exists arena_customers_admin_update on public.arena_customers;
create policy arena_customers_admin_update on public.arena_customers for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_customers_admin_delete on public.arena_customers;
create policy arena_customers_admin_delete on public.arena_customers for delete to authenticated using (public.is_admin());

drop policy if exists arena_subscriptions_admin_select on public.arena_customer_subscriptions;
create policy arena_subscriptions_admin_select on public.arena_customer_subscriptions for select to authenticated using (public.is_admin());
drop policy if exists arena_subscriptions_admin_insert on public.arena_customer_subscriptions;
create policy arena_subscriptions_admin_insert on public.arena_customer_subscriptions for insert to authenticated with check (public.is_admin());
drop policy if exists arena_subscriptions_admin_update on public.arena_customer_subscriptions;
create policy arena_subscriptions_admin_update on public.arena_customer_subscriptions for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_subscriptions_admin_delete on public.arena_customer_subscriptions;
create policy arena_subscriptions_admin_delete on public.arena_customer_subscriptions for delete to authenticated using (public.is_admin());

drop policy if exists arena_credit_movements_admin_select on public.arena_credit_movements;
create policy arena_credit_movements_admin_select on public.arena_credit_movements for select to authenticated using (public.is_admin());
drop policy if exists arena_credit_movements_admin_insert on public.arena_credit_movements;
create policy arena_credit_movements_admin_insert on public.arena_credit_movements for insert to authenticated with check (public.is_admin());
drop policy if exists arena_credit_movements_admin_update on public.arena_credit_movements;
create policy arena_credit_movements_admin_update on public.arena_credit_movements for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_credit_movements_admin_delete on public.arena_credit_movements;
create policy arena_credit_movements_admin_delete on public.arena_credit_movements for delete to authenticated using (public.is_admin());

drop policy if exists arena_reservations_admin_select on public.arena_reservations;
create policy arena_reservations_admin_select on public.arena_reservations for select to authenticated using (public.is_admin());
drop policy if exists arena_reservations_admin_insert on public.arena_reservations;
create policy arena_reservations_admin_insert on public.arena_reservations for insert to authenticated with check (public.is_admin());
drop policy if exists arena_reservations_admin_update on public.arena_reservations;
create policy arena_reservations_admin_update on public.arena_reservations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_reservations_admin_delete on public.arena_reservations;
create policy arena_reservations_admin_delete on public.arena_reservations for delete to authenticated using (public.is_admin());

drop policy if exists arena_maintenance_admin_select on public.arena_station_maintenance;
create policy arena_maintenance_admin_select on public.arena_station_maintenance for select to authenticated using (public.is_admin());
drop policy if exists arena_maintenance_admin_insert on public.arena_station_maintenance;
create policy arena_maintenance_admin_insert on public.arena_station_maintenance for insert to authenticated with check (public.is_admin());
drop policy if exists arena_maintenance_admin_update on public.arena_station_maintenance;
create policy arena_maintenance_admin_update on public.arena_station_maintenance for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_maintenance_admin_delete on public.arena_station_maintenance;
create policy arena_maintenance_admin_delete on public.arena_station_maintenance for delete to authenticated using (public.is_admin());

drop policy if exists admin_notifications_admin_select on public.admin_notifications;
create policy admin_notifications_admin_select on public.admin_notifications for select to authenticated using (public.is_admin());
drop policy if exists admin_notifications_admin_insert on public.admin_notifications;
create policy admin_notifications_admin_insert on public.admin_notifications for insert to authenticated with check (public.is_admin());
drop policy if exists admin_notifications_admin_update on public.admin_notifications;
create policy admin_notifications_admin_update on public.admin_notifications for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_notifications_admin_delete on public.admin_notifications;
create policy admin_notifications_admin_delete on public.admin_notifications for delete to authenticated using (public.is_admin());

drop function if exists public.find_arena_customer_plan_by_phone(text);

create or replace function public.find_arena_customer_plan_by_phone(p_phone text)
returns table (
  has_plan boolean,
  has_active_plan boolean,
  has_balance boolean,
  expired boolean,
  plan_name text,
  remaining_minutes integer,
  expiration_date date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
begin
  v_phone := public.normalize_arena_phone(p_phone);

  return query
  select
    true as has_plan,
    (
      customer.active = true
      and plan.active = true
      and subscription.status = 'ativo'
      and subscription.expiration_date >= current_date
      and subscription.remaining_minutes > 0
    ) as has_active_plan,
    (subscription.remaining_minutes > 0) as has_balance,
    (subscription.expiration_date < current_date or subscription.status <> 'ativo') as expired,
    plan.name as plan_name,
    subscription.remaining_minutes,
    subscription.expiration_date
  from public.arena_customers customer
  join public.arena_customer_subscriptions subscription on subscription.customer_id = customer.id
  join public.arena_monthly_plans plan on plan.id = subscription.plan_id
  where customer.normalized_phone = v_phone
  order by subscription.expiration_date desc, subscription.created_at desc
  limit 1;
end;
$$;

create or replace function public.list_public_arena_busy_slots(p_reservation_date date)
returns table (
  station_id uuid,
  reservation_date date,
  start_time time,
  end_time time,
  status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    reservation.station_id,
    reservation.reservation_date,
    reservation.start_time,
    reservation.end_time,
    reservation.status
  from public.arena_reservations reservation
  where reservation.reservation_date = p_reservation_date
    and (
      reservation.status in ('pendente', 'confirmado', 'bloqueado')
      or coalesce(reservation.session_status, '') in ('em_andamento', 'pausada')
    );
$$;

revoke execute on all functions in schema public from anon, authenticated;
grant execute on all functions in schema public to service_role;

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.normalize_arena_phone(text) to anon, authenticated;
grant execute on function public.find_arena_customer_plan_by_phone(text) to anon, authenticated;
grant execute on function public.arena_has_active_maintenance(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.create_arena_reservation(uuid, text, text, date, time, integer, text, text, uuid) to anon, authenticated;
grant execute on function public.list_public_arena_busy_slots(date) to anon, authenticated;

alter function public.activate_arena_subscription(uuid, uuid, date, numeric, text, boolean) security invoker;
alter function public.adjust_arena_credits(uuid, text, integer, text, text) security invoker;
alter function public.consume_arena_credits(uuid) security invoker;
alter function public.refund_arena_credits(uuid) security invoker;
alter function public.update_arena_reservation_status(uuid, text) security invoker;
alter function public.create_arena_block(uuid, date, time, time, text) security invoker;
alter function public.start_arena_session(uuid) security invoker;
alter function public.pause_arena_session(uuid) security invoker;
alter function public.resume_arena_session(uuid) security invoker;
alter function public.end_arena_session(uuid) security invoker;
alter function public.create_arena_station_maintenance(uuid, text, text, text, timestamptz, timestamptz, text) security invoker;
alter function public.finish_arena_station_maintenance(uuid) security invoker;
alter function public.cancel_arena_station_maintenance(uuid) security invoker;
alter function public.create_or_find_arena_customer(text, text, text, text) security invoker;

grant execute on function public.activate_arena_subscription(uuid, uuid, date, numeric, text, boolean) to authenticated;
grant execute on function public.adjust_arena_credits(uuid, text, integer, text, text) to authenticated;
grant execute on function public.consume_arena_credits(uuid) to authenticated;
grant execute on function public.refund_arena_credits(uuid) to authenticated;
grant execute on function public.update_arena_reservation_status(uuid, text) to authenticated;
grant execute on function public.create_arena_block(uuid, date, time, time, text) to authenticated;
grant execute on function public.start_arena_session(uuid) to authenticated;
grant execute on function public.pause_arena_session(uuid) to authenticated;
grant execute on function public.resume_arena_session(uuid) to authenticated;
grant execute on function public.end_arena_session(uuid) to authenticated;
grant execute on function public.create_arena_station_maintenance(uuid, text, text, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.finish_arena_station_maintenance(uuid) to authenticated;
grant execute on function public.cancel_arena_station_maintenance(uuid) to authenticated;
grant execute on function public.create_or_find_arena_customer(text, text, text, text) to authenticated;

commit;
