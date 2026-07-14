create extension if not exists pgcrypto;

create table if not exists public.arena_stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('pc', 'ps5')),
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arena_settings (
  id uuid primary key default gen_random_uuid(),
  price_per_hour numeric(10,2) not null default 20.00,
  opening_time time not null default '09:00',
  closing_time time not null default '22:00',
  slot_minutes integer not null default 30 check (slot_minutes in (15, 30, 60)),
  active_days integer[] not null default array[1,2,3,4,5,6],
  reservation_notice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arena_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (duration_minutes)
);

create table if not exists public.arena_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  normalized_phone text not null unique,
  email text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arena_monthly_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(12,2) not null,
  included_minutes integer not null check (included_minutes > 0),
  validity_days integer not null default 30 check (validity_days > 0),
  description text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arena_customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.arena_customers(id) on delete cascade,
  plan_id uuid not null references public.arena_monthly_plans(id),
  start_date date not null,
  expiration_date date not null,
  total_minutes integer not null check (total_minutes >= 0),
  used_minutes integer not null default 0 check (used_minutes >= 0),
  remaining_minutes integer not null check (remaining_minutes >= 0),
  status text not null default 'ativo' check (status in ('ativo', 'expirado', 'suspenso', 'cancelado', 'encerrado')),
  amount_paid numeric(12,2),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiration_date >= start_date)
);

create table if not exists public.arena_reservations (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.arena_stations(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  reservation_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  total_price numeric(10,2) not null default 0,
  status text not null default 'pendente' check (status in ('pendente', 'confirmado', 'cancelado', 'concluido', 'bloqueado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.arena_reservations
  add column if not exists customer_id uuid references public.arena_customers(id) on delete set null,
  add column if not exists subscription_id uuid references public.arena_customer_subscriptions(id) on delete set null,
  add column if not exists payment_type text not null default 'avulso',
  add column if not exists credits_consumed_minutes integer not null default 0,
  add column if not exists credits_processed boolean not null default false;

alter table public.arena_stations
  add column if not exists processor text not null default '',
  add column if not exists graphics_card text not null default '',
  add column if not exists memory text not null default '',
  add column if not exists storage text not null default '',
  add column if not exists monitor text not null default '',
  add column if not exists accessories text not null default '',
  add column if not exists image_url text not null default '',
  add column if not exists availability_status text not null default 'disponivel',
  add column if not exists internal_notes text not null default '';

alter table public.arena_stations
  drop constraint if exists arena_stations_availability_status_check;

alter table public.arena_stations
  add constraint arena_stations_availability_status_check
  check (availability_status in ('disponivel', 'ocupado', 'manutencao', 'inativo'));

alter table public.arena_reservations
  add column if not exists session_started_at timestamptz,
  add column if not exists session_paused_at timestamptz,
  add column if not exists session_resumed_at timestamptz,
  add column if not exists session_ended_at timestamptz,
  add column if not exists session_status text not null default 'nao_iniciada',
  add column if not exists paused_seconds integer not null default 0,
  add column if not exists actual_duration_minutes integer not null default 0,
  add column if not exists overtime_minutes integer not null default 0;

alter table public.arena_reservations
  drop constraint if exists arena_reservations_session_status_check;

alter table public.arena_reservations
  add constraint arena_reservations_session_status_check
  check (session_status in ('nao_iniciada', 'em_andamento', 'pausada', 'encerrada'));

alter table public.arena_reservations
  drop constraint if exists arena_reservations_payment_type_check;

alter table public.arena_reservations
  add constraint arena_reservations_payment_type_check check (payment_type in ('avulso', 'plano'));

create table if not exists public.arena_credit_movements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.arena_customer_subscriptions(id) on delete cascade,
  customer_id uuid not null references public.arena_customers(id) on delete cascade,
  reservation_id uuid references public.arena_reservations(id) on delete set null,
  type text not null check (type in ('credito', 'consumo', 'ajuste', 'estorno', 'renovacao')),
  minutes integer not null,
  previous_balance integer not null check (previous_balance >= 0),
  new_balance integer not null check (new_balance >= 0),
  reason text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.arena_station_maintenance (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.arena_stations(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null check (status in ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  started_at timestamptz not null default now(),
  expected_end_at timestamptz,
  ended_at timestamptz,
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  priority text not null default 'normal' check (priority in ('baixa', 'normal', 'alta', 'critica')),
  entity_type text not null default '',
  entity_id uuid,
  action_url text not null default '',
  read boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

create index if not exists arena_stations_active_idx
  on public.arena_stations(active, sort_order);

create index if not exists arena_reservations_lookup_idx
  on public.arena_reservations(reservation_date, station_id, status, start_time, end_time);

create index if not exists arena_packages_active_idx
  on public.arena_packages(active, sort_order);

create index if not exists arena_customers_phone_idx
  on public.arena_customers(normalized_phone);

create index if not exists arena_subscriptions_customer_status_idx
  on public.arena_customer_subscriptions(customer_id, status, expiration_date);

create index if not exists arena_credit_movements_customer_idx
  on public.arena_credit_movements(customer_id, created_at desc);

create index if not exists arena_reservations_session_idx
  on public.arena_reservations(station_id, session_status, reservation_date, start_time);

create index if not exists arena_station_maintenance_status_idx
  on public.arena_station_maintenance(station_id, status, started_at, expected_end_at);

create index if not exists admin_notifications_lookup_idx
  on public.admin_notifications(dismissed, read, priority, created_at desc);

create unique index if not exists admin_notifications_dedupe_idx
  on public.admin_notifications(type, entity_type, entity_id)
  where dismissed = false;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arena_stations_set_updated_at on public.arena_stations;
create trigger arena_stations_set_updated_at
before update on public.arena_stations
for each row execute function public.set_updated_at();

drop trigger if exists arena_settings_set_updated_at on public.arena_settings;
create trigger arena_settings_set_updated_at
before update on public.arena_settings
for each row execute function public.set_updated_at();

drop trigger if exists arena_reservations_set_updated_at on public.arena_reservations;
create trigger arena_reservations_set_updated_at
before update on public.arena_reservations
for each row execute function public.set_updated_at();

drop trigger if exists arena_packages_set_updated_at on public.arena_packages;
create trigger arena_packages_set_updated_at
before update on public.arena_packages
for each row execute function public.set_updated_at();

drop trigger if exists arena_customers_set_updated_at on public.arena_customers;
create trigger arena_customers_set_updated_at
before update on public.arena_customers
for each row execute function public.set_updated_at();

drop trigger if exists arena_monthly_plans_set_updated_at on public.arena_monthly_plans;
create trigger arena_monthly_plans_set_updated_at
before update on public.arena_monthly_plans
for each row execute function public.set_updated_at();

drop trigger if exists arena_customer_subscriptions_set_updated_at on public.arena_customer_subscriptions;
create trigger arena_customer_subscriptions_set_updated_at
before update on public.arena_customer_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists arena_station_maintenance_set_updated_at on public.arena_station_maintenance;
create trigger arena_station_maintenance_set_updated_at
before update on public.arena_station_maintenance
for each row execute function public.set_updated_at();

insert into public.arena_settings (
  price_per_hour,
  opening_time,
  closing_time,
  slot_minutes,
  active_days,
  reservation_notice
)
select
  20.00,
  '09:00',
  '22:00',
  30,
  array[1,2,3,4,5,6],
  'Sua solicitação foi enviada. A reserva será confirmada pela NT Informática.'
where not exists (select 1 from public.arena_settings);

insert into public.arena_stations (name, type, description, active, sort_order)
select 'PC Gamer 01', 'pc', 'Computador gamer de alto desempenho para partidas online.', true, 10
where not exists (select 1 from public.arena_stations where lower(name) = lower('PC Gamer 01'));

insert into public.arena_stations (name, type, description, active, sort_order)
select 'PlayStation 5', 'ps5', 'Console PlayStation 5 para jogar com amigos.', true, 20
where not exists (select 1 from public.arena_stations where lower(name) = lower('PlayStation 5'));

insert into public.arena_packages (name, duration_minutes, price, active, sort_order)
values
  ('1 Hora', 60, 20.00, true, 10),
  ('2 Horas', 120, 40.00, true, 20),
  ('3 Horas', 180, 50.00, true, 30)
on conflict (duration_minutes) do update
set
  name = excluded.name,
  price = excluded.price,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.arena_monthly_plans (name, price, included_minutes, validity_days, description, active, sort_order)
values
  ('Plano Player', 150.00, 600, 30, '10 horas mensais para jogar na NT Arena Gamer, com validade de 30 dias.', true, 1),
  ('Plano Pro', 250.00, 1200, 30, '20 horas mensais para jogar na NT Arena Gamer, com validade de 30 dias.', true, 2),
  ('Plano Squad', 400.00, 2400, 30, '40 horas mensais para jogar na NT Arena Gamer, equivalente a R$ 10,00 por hora.', true, 3)
on conflict (name) do update
set
  price = excluded.price,
  included_minutes = excluded.included_minutes,
  validity_days = excluded.validity_days,
  description = excluded.description,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.normalize_arena_phone(p_phone text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
$$;

create or replace function public.create_or_find_arena_customer(
  p_name text,
  p_phone text,
  p_email text default '',
  p_notes text default ''
)
returns setof public.arena_customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_customer public.arena_customers;
begin
  v_phone := public.normalize_arena_phone(p_phone);

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Nome obrigatório.';
  end if;

  if nullif(v_phone, '') is null then
    raise exception 'WhatsApp obrigatório.';
  end if;

  insert into public.arena_customers (name, phone, normalized_phone, email, notes, active)
  values (
    trim(p_name),
    trim(p_phone),
    v_phone,
    trim(coalesce(p_email, '')),
    trim(coalesce(p_notes, '')),
    true
  )
  on conflict (normalized_phone) do update
  set
    name = case when nullif(trim(excluded.name), '') is null then arena_customers.name else excluded.name end,
    phone = excluded.phone,
    email = case when nullif(trim(excluded.email), '') is null then arena_customers.email else excluded.email end,
    notes = case when nullif(trim(excluded.notes), '') is null then arena_customers.notes else excluded.notes end,
    updated_at = now()
  returning * into v_customer;

  return next v_customer;
end;
$$;

drop function if exists public.find_arena_customer_plan_by_phone(text);

create or replace function public.find_arena_customer_plan_by_phone(p_phone text)
returns table (
  has_active_plan boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := public.normalize_arena_phone(p_phone);

  return query
  select
    (
      customer.active = true
      and plan.active = true
      and subscription.status = 'ativo'
      and subscription.expiration_date >= current_date
      and subscription.remaining_minutes > 0
    ) as has_active_plan
  from public.arena_customers customer
  join public.arena_customer_subscriptions subscription on subscription.customer_id = customer.id
  join public.arena_monthly_plans plan on plan.id = subscription.plan_id
  where customer.normalized_phone = v_phone
  order by subscription.expiration_date desc, subscription.created_at desc
  limit 1;
end;
$$;

create or replace function public.activate_arena_subscription(
  p_customer_id uuid,
  p_plan_id uuid,
  p_start_date date default current_date,
  p_amount_paid numeric default null,
  p_notes text default '',
  p_keep_previous_balance boolean default false
)
returns setof public.arena_customer_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.arena_customers;
  v_plan public.arena_monthly_plans;
  v_previous_remaining integer := 0;
  v_subscription public.arena_customer_subscriptions;
  v_total integer;
begin
  select * into v_customer from public.arena_customers where id = p_customer_id and active = true;
  if not found then
    raise exception 'Cliente não encontrado ou inativo.';
  end if;

  select * into v_plan from public.arena_monthly_plans where id = p_plan_id and active = true;
  if not found then
    raise exception 'Plano mensal não encontrado ou inativo.';
  end if;

  if p_keep_previous_balance then
    select coalesce(sum(remaining_minutes), 0)
      into v_previous_remaining
      from public.arena_customer_subscriptions
      where customer_id = p_customer_id
        and status = 'ativo'
        and expiration_date >= current_date;
  end if;

  update public.arena_customer_subscriptions
    set status = 'encerrado'
    where customer_id = p_customer_id
      and status = 'ativo'
      and id is not null;

  v_total := v_plan.included_minutes + coalesce(v_previous_remaining, 0);

  insert into public.arena_customer_subscriptions (
    customer_id,
    plan_id,
    start_date,
    expiration_date,
    total_minutes,
    used_minutes,
    remaining_minutes,
    status,
    amount_paid,
    notes
  )
  values (
    p_customer_id,
    p_plan_id,
    coalesce(p_start_date, current_date),
    coalesce(p_start_date, current_date) + (v_plan.validity_days - 1),
    v_total,
    0,
    v_total,
    'ativo',
    coalesce(p_amount_paid, v_plan.price),
    trim(coalesce(p_notes, ''))
  )
  returning * into v_subscription;

  insert into public.arena_credit_movements (
    subscription_id,
    customer_id,
    type,
    minutes,
    previous_balance,
    new_balance,
    reason,
    notes
  )
  values (
    v_subscription.id,
    p_customer_id,
    case when v_previous_remaining > 0 then 'renovacao' else 'credito' end,
    v_total,
    v_previous_remaining,
    v_total,
    'Ativação de plano mensal',
    trim(coalesce(p_notes, ''))
  );

  return next v_subscription;
end;
$$;

create or replace function public.adjust_arena_credits(
  p_subscription_id uuid,
  p_type text,
  p_minutes integer,
  p_reason text default '',
  p_notes text default ''
)
returns setof public.arena_customer_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.arena_customer_subscriptions;
  v_previous integer;
  v_new integer;
  v_delta integer;
  v_type text;
begin
  if p_minutes is null or p_minutes < 0 then
    raise exception 'Informe uma quantidade válida de minutos.';
  end if;

  v_type := coalesce(p_type, 'ajuste');

  select * into v_subscription
    from public.arena_customer_subscriptions
    where id = p_subscription_id
    for update;

  if not found then
    raise exception 'Assinatura não encontrada.';
  end if;

  v_previous := v_subscription.remaining_minutes;

  if v_type in ('credito', 'estorno', 'renovacao') then
    v_new := v_previous + p_minutes;
    v_delta := p_minutes;
  elsif v_type = 'consumo' then
    if v_previous < p_minutes then
      raise exception 'Saldo de horas insuficiente para esta reserva.';
    end if;
    v_new := v_previous - p_minutes;
    v_delta := p_minutes;
  else
    v_new := p_minutes;
    v_delta := abs(v_new - v_previous);
  end if;

  if v_new < 0 then
    raise exception 'Saldo de horas insuficiente para esta reserva.';
  end if;

  update public.arena_customer_subscriptions
    set
      remaining_minutes = v_new,
      used_minutes = greatest(0, total_minutes - v_new)
    where id = p_subscription_id
    returning * into v_subscription;

  insert into public.arena_credit_movements (
    subscription_id,
    customer_id,
    type,
    minutes,
    previous_balance,
    new_balance,
    reason,
    notes
  )
  values (
    v_subscription.id,
    v_subscription.customer_id,
    case when v_type in ('credito', 'consumo', 'ajuste', 'estorno', 'renovacao') then v_type else 'ajuste' end,
    v_delta,
    v_previous,
    v_new,
    trim(coalesce(p_reason, 'Ajuste manual de saldo')),
    trim(coalesce(p_notes, ''))
  );

  return next v_subscription;
end;
$$;

create or replace function public.consume_arena_credits(p_reservation_id uuid)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.arena_reservations;
  v_subscription public.arena_customer_subscriptions;
  v_customer public.arena_customers;
  v_plan public.arena_monthly_plans;
  v_previous integer;
  v_new integer;
begin
  select * into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_reservation.payment_type <> 'plano' then
    return next v_reservation;
    return;
  end if;

  if v_reservation.credits_processed then
    return next v_reservation;
    return;
  end if;

  select * into v_subscription
    from public.arena_customer_subscriptions
    where id = v_reservation.subscription_id
    for update;

  if not found then
    raise exception 'Assinatura não encontrada.';
  end if;

  select * into v_customer from public.arena_customers where id = v_subscription.customer_id;
  select * into v_plan from public.arena_monthly_plans where id = v_subscription.plan_id;

  if not coalesce(v_customer.active, false) then
    raise exception 'Cliente inativo.';
  end if;

  if not coalesce(v_plan.active, false) then
    raise exception 'Plano mensal inativo.';
  end if;

  if v_subscription.status <> 'ativo' then
    raise exception 'Assinatura não está ativa.';
  end if;

  if v_subscription.expiration_date < current_date then
    raise exception 'Plano mensal expirado.';
  end if;

  if v_subscription.remaining_minutes < v_reservation.duration_minutes then
    raise exception 'Saldo de horas insuficiente para esta reserva.';
  end if;

  v_previous := v_subscription.remaining_minutes;
  v_new := v_previous - v_reservation.duration_minutes;

  update public.arena_customer_subscriptions
    set
      remaining_minutes = v_new,
      used_minutes = used_minutes + v_reservation.duration_minutes
    where id = v_subscription.id;

  insert into public.arena_credit_movements (
    subscription_id,
    customer_id,
    reservation_id,
    type,
    minutes,
    previous_balance,
    new_balance,
    reason
  )
  values (
    v_subscription.id,
    v_subscription.customer_id,
    v_reservation.id,
    'consumo',
    v_reservation.duration_minutes,
    v_previous,
    v_new,
    'Consumo de reserva confirmada'
  );

  update public.arena_reservations
    set
      credits_consumed_minutes = v_reservation.duration_minutes,
      credits_processed = true
    where id = v_reservation.id
    returning * into v_reservation;

  return next v_reservation;
end;
$$;

create or replace function public.refund_arena_credits(p_reservation_id uuid)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.arena_reservations;
  v_subscription public.arena_customer_subscriptions;
  v_previous integer;
  v_new integer;
  v_minutes integer;
begin
  select * into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_reservation.payment_type <> 'plano' or not v_reservation.credits_processed then
    return next v_reservation;
    return;
  end if;

  v_minutes := greatest(v_reservation.credits_consumed_minutes, v_reservation.duration_minutes);

  select * into v_subscription
    from public.arena_customer_subscriptions
    where id = v_reservation.subscription_id
    for update;

  if not found then
    raise exception 'Assinatura não encontrada.';
  end if;

  v_previous := v_subscription.remaining_minutes;
  v_new := v_previous + v_minutes;

  update public.arena_customer_subscriptions
    set
      remaining_minutes = v_new,
      used_minutes = greatest(0, used_minutes - v_minutes)
    where id = v_subscription.id;

  insert into public.arena_credit_movements (
    subscription_id,
    customer_id,
    reservation_id,
    type,
    minutes,
    previous_balance,
    new_balance,
    reason
  )
  values (
    v_subscription.id,
    v_subscription.customer_id,
    v_reservation.id,
    'estorno',
    v_minutes,
    v_previous,
    v_new,
    'Estorno por cancelamento de reserva'
  );

  update public.arena_reservations
    set
      credits_consumed_minutes = 0,
      credits_processed = false
    where id = v_reservation.id
    returning * into v_reservation;

  return next v_reservation;
end;
$$;

create or replace function public.update_arena_reservation_status(
  p_reservation_id uuid,
  p_status text
)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.arena_reservations;
begin
  if p_status not in ('pendente', 'confirmado', 'cancelado', 'concluido', 'bloqueado') then
    raise exception 'Status inválido.';
  end if;

  if p_status = 'confirmado' then
    perform public.consume_arena_credits(p_reservation_id);
  elsif p_status = 'cancelado' then
    perform public.refund_arena_credits(p_reservation_id);
  end if;

  update public.arena_reservations
    set status = p_status
    where id = p_reservation_id
    returning * into v_reservation;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  return next v_reservation;
end;
$$;

create or replace function public.create_arena_reservation(
  p_station_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_reservation_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_notes text default null,
  p_payment_type text default 'avulso',
  p_subscription_id uuid default null
)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.arena_settings;
  v_station public.arena_stations;
  v_end_time time;
  v_total_price numeric(10,2);
  v_row public.arena_reservations;
  v_day integer;
  v_package public.arena_packages;
  v_customer public.arena_customers;
  v_subscription public.arena_customer_subscriptions;
begin
  if p_station_id is null then
    raise exception 'Equipamento obrigatório.';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Nome obrigatório.';
  end if;

  if nullif(trim(coalesce(p_customer_phone, '')), '') is null then
    raise exception 'WhatsApp obrigatório.';
  end if;

  if p_reservation_date is null or p_start_time is null then
    raise exception 'Data e horário são obrigatórios.';
  end if;

  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duração inválida.';
  end if;

  select *
    into v_settings
    from public.arena_settings
    order by created_at asc
    limit 1;

  if not found then
    raise exception 'Configuração da Arena não encontrada.';
  end if;

  select *
    into v_station
    from public.arena_stations
    where id = p_station_id and active = true;

  if not found then
    raise exception 'Equipamento indisponível.';
  end if;

  if v_station.availability_status in ('manutencao', 'inativo') then
    raise exception 'Equipamento indisponível.';
  end if;

  v_day := extract(dow from p_reservation_date)::integer;
  if not (v_day = any(v_settings.active_days)) then
    raise exception 'A Arena não atende neste dia.';
  end if;

  v_end_time := (p_start_time + make_interval(mins => p_duration_minutes))::time;
  if v_end_time <= p_start_time then
    raise exception 'Horário final inválido.';
  end if;

  if p_start_time < v_settings.opening_time or v_end_time > v_settings.closing_time then
    raise exception 'Horário fora do funcionamento da Arena.';
  end if;

  if exists (
    select 1
      from public.arena_reservations reservation
      where reservation.station_id = p_station_id
        and reservation.reservation_date = p_reservation_date
        and reservation.status in ('pendente', 'confirmado', 'bloqueado')
        and reservation.start_time < v_end_time
        and reservation.end_time > p_start_time
  ) then
    raise exception 'Horário indisponível.';
  end if;

  if exists (
    select 1
      from public.arena_station_maintenance maintenance
      where maintenance.station_id = p_station_id
        and maintenance.status in ('agendada', 'em_andamento')
        and maintenance.started_at < ((p_reservation_date + v_end_time)::timestamptz)
        and coalesce(maintenance.expected_end_at, 'infinity'::timestamptz) > ((p_reservation_date + p_start_time)::timestamptz)
  ) then
    raise exception 'Equipamento em manutenção neste período.';
  end if;

  if coalesce(p_payment_type, 'avulso') = 'plano' then
    select * into v_customer
      from public.create_or_find_arena_customer(p_customer_name, p_customer_phone);

    if p_subscription_id is not null then
      select * into v_subscription
        from public.arena_customer_subscriptions
        where id = p_subscription_id
          and customer_id = v_customer.id;
    else
      select subscription.*
        into v_subscription
        from public.arena_customer_subscriptions subscription
        join public.arena_monthly_plans plan on plan.id = subscription.plan_id
        where subscription.customer_id = v_customer.id
          and subscription.status = 'ativo'
          and subscription.expiration_date >= current_date
          and subscription.remaining_minutes >= p_duration_minutes
          and plan.active = true
        order by subscription.expiration_date asc, subscription.created_at desc
        limit 1;
    end if;

    if not found then
      raise exception 'Plano mensal expirado ou saldo de horas insuficiente para esta reserva.';
    end if;

    if not exists (
      select 1
        from public.arena_monthly_plans plan
        where plan.id = v_subscription.plan_id
          and plan.active = true
    ) then
      raise exception 'Plano mensal inativo.';
    end if;

    if v_subscription.status <> 'ativo' then
      raise exception 'Assinatura não está ativa.';
    end if;

    if v_subscription.expiration_date < current_date then
      raise exception 'Plano mensal expirado.';
    end if;

    if v_subscription.remaining_minutes < p_duration_minutes then
      raise exception 'Saldo de horas insuficiente para esta reserva.';
    end if;
  else
    select * into v_customer
      from public.create_or_find_arena_customer(p_customer_name, p_customer_phone);
  end if;

  select *
    into v_package
    from public.arena_packages
    where duration_minutes = p_duration_minutes
      and active = true
    order by sort_order asc
    limit 1;

  if found then
    v_total_price := v_package.price;
  else
    v_total_price := round((p_duration_minutes::numeric / 60) * v_settings.price_per_hour, 2);
  end if;

  insert into public.arena_reservations (
    station_id,
    customer_name,
    customer_phone,
    reservation_date,
    start_time,
    end_time,
    duration_minutes,
    total_price,
    status,
    notes,
    customer_id,
    subscription_id,
    payment_type
  )
  values (
    p_station_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    p_reservation_date,
    p_start_time,
    v_end_time,
    p_duration_minutes,
    v_total_price,
    'pendente',
    nullif(trim(coalesce(p_notes, '')), ''),
    v_customer.id,
    case when coalesce(p_payment_type, 'avulso') = 'plano' then v_subscription.id else null end,
    case when coalesce(p_payment_type, 'avulso') = 'plano' then 'plano' else 'avulso' end
  )
  returning * into v_row;

  return next v_row;
end;
$$;

create or replace function public.create_arena_block(
  p_station_id uuid,
  p_reservation_date date,
  p_start_time time,
  p_end_time time,
  p_reason text default null
)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station public.arena_stations;
  v_row public.arena_reservations;
  v_duration integer;
begin
  if p_station_id is null or p_reservation_date is null or p_start_time is null or p_end_time is null then
    raise exception 'Equipamento, data, início e fim são obrigatórios.';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'Horário final inválido.';
  end if;

  select *
    into v_station
    from public.arena_stations
    where id = p_station_id and active = true;

  if not found then
    raise exception 'Equipamento indisponível.';
  end if;

  if v_station.availability_status in ('manutencao', 'inativo') then
    raise exception 'Equipamento indisponível.';
  end if;

  if exists (
    select 1
      from public.arena_reservations reservation
      where reservation.station_id = p_station_id
        and reservation.reservation_date = p_reservation_date
        and reservation.status in ('pendente', 'confirmado', 'bloqueado')
        and reservation.start_time < p_end_time
        and reservation.end_time > p_start_time
  ) then
    raise exception 'Horário indisponível.';
  end if;

  v_duration := extract(epoch from (p_end_time - p_start_time))::integer / 60;

  insert into public.arena_reservations (
    station_id,
    customer_name,
    customer_phone,
    reservation_date,
    start_time,
    end_time,
    duration_minutes,
    total_price,
    status,
    notes
  )
  values (
    p_station_id,
    'Bloqueio manual',
    '',
    p_reservation_date,
    p_start_time,
    p_end_time,
    v_duration,
    0,
    'bloqueado',
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning * into v_row;

  return next v_row;
end;
$$;

create or replace function public.arena_has_active_maintenance(
  p_station_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.arena_station_maintenance maintenance
      where maintenance.station_id = p_station_id
        and maintenance.status in ('agendada', 'em_andamento')
        and maintenance.started_at < p_end_at
        and coalesce(maintenance.expected_end_at, 'infinity'::timestamptz) > p_start_at
  );
$$;

create or replace function public.start_arena_session(p_reservation_id uuid)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.arena_reservations;
begin
  select *
    into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_reservation.status = 'cancelado' then
    raise exception 'Não é possível iniciar uma reserva cancelada.';
  end if;

  if v_reservation.status = 'bloqueado' then
    raise exception 'Não é possível iniciar um bloqueio de horário.';
  end if;

  if v_reservation.session_status = 'encerrada' then
    raise exception 'Sessão já encerrada.';
  end if;

  if exists (
    select 1
      from public.arena_reservations reservation
      where reservation.station_id = v_reservation.station_id
        and reservation.id <> v_reservation.id
        and reservation.session_status in ('em_andamento', 'pausada')
  ) then
    raise exception 'Já existe uma sessão em andamento neste equipamento.';
  end if;

  if exists (
    select 1
      from public.arena_stations station
      where station.id = v_reservation.station_id
        and (station.active = false or station.availability_status in ('manutencao', 'inativo'))
  ) then
    raise exception 'Equipamento indisponível.';
  end if;

  if v_reservation.payment_type = 'plano' and not v_reservation.credits_processed then
    perform public.consume_arena_credits(v_reservation.id);
  end if;

  update public.arena_reservations
    set
      status = case when status = 'pendente' then 'confirmado' else status end,
      session_started_at = coalesce(session_started_at, now()),
      session_resumed_at = now(),
      session_paused_at = null,
      session_status = 'em_andamento'
    where id = v_reservation.id
    returning * into v_reservation;

  update public.arena_stations
    set availability_status = 'ocupado'
    where id = v_reservation.station_id
      and availability_status <> 'manutencao';

  return next v_reservation;
end;
$$;

create or replace function public.pause_arena_session(p_reservation_id uuid)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.arena_reservations;
begin
  select * into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_reservation.session_status <> 'em_andamento' then
    raise exception 'Somente sessões em andamento podem ser pausadas.';
  end if;

  update public.arena_reservations
    set session_status = 'pausada', session_paused_at = now()
    where id = v_reservation.id
    returning * into v_reservation;

  return next v_reservation;
end;
$$;

create or replace function public.resume_arena_session(p_reservation_id uuid)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.arena_reservations;
  v_extra_pause integer := 0;
begin
  select * into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_reservation.session_status <> 'pausada' then
    raise exception 'Somente sessões pausadas podem ser retomadas.';
  end if;

  if v_reservation.session_paused_at is not null then
    v_extra_pause := greatest(0, extract(epoch from (now() - v_reservation.session_paused_at))::integer);
  end if;

  update public.arena_reservations
    set
      session_status = 'em_andamento',
      session_resumed_at = now(),
      session_paused_at = null,
      paused_seconds = paused_seconds + v_extra_pause
    where id = v_reservation.id
    returning * into v_reservation;

  return next v_reservation;
end;
$$;

create or replace function public.end_arena_session(p_reservation_id uuid)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.arena_reservations;
  v_paused_seconds integer;
  v_actual_minutes integer;
  v_overtime integer;
begin
  select * into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_reservation.session_status = 'encerrada' then
    return next v_reservation;
    return;
  end if;

  if v_reservation.session_started_at is null then
    raise exception 'Sessão ainda não foi iniciada.';
  end if;

  if v_reservation.payment_type = 'plano' and not v_reservation.credits_processed then
    perform public.consume_arena_credits(v_reservation.id);
  end if;

  v_paused_seconds := v_reservation.paused_seconds;
  if v_reservation.session_status = 'pausada' and v_reservation.session_paused_at is not null then
    v_paused_seconds := v_paused_seconds + greatest(0, extract(epoch from (now() - v_reservation.session_paused_at))::integer);
  end if;

  v_actual_minutes := greatest(0, ceil(greatest(0, extract(epoch from (now() - v_reservation.session_started_at))::numeric - v_paused_seconds) / 60.0)::integer);
  v_overtime := greatest(0, v_actual_minutes - v_reservation.duration_minutes);

  update public.arena_reservations
    set
      status = 'concluido',
      session_status = 'encerrada',
      session_ended_at = now(),
      session_paused_at = null,
      paused_seconds = v_paused_seconds,
      actual_duration_minutes = v_actual_minutes,
      overtime_minutes = v_overtime
    where id = v_reservation.id
    returning * into v_reservation;

  if not exists (
    select 1 from public.arena_reservations reservation
    where reservation.station_id = v_reservation.station_id
      and reservation.id <> v_reservation.id
      and reservation.session_status in ('em_andamento', 'pausada')
  ) and not exists (
    select 1 from public.arena_station_maintenance maintenance
    where maintenance.station_id = v_reservation.station_id
      and maintenance.status in ('agendada', 'em_andamento')
  ) then
    update public.arena_stations
      set availability_status = case when active then 'disponivel' else 'inativo' end
      where id = v_reservation.station_id;
  end if;

  return next v_reservation;
end;
$$;

create or replace function public.create_arena_station_maintenance(
  p_station_id uuid,
  p_title text,
  p_description text default '',
  p_status text default 'em_andamento',
  p_started_at timestamptz default null,
  p_expected_end_at timestamptz default null,
  p_internal_notes text default ''
)
returns setof public.arena_station_maintenance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.arena_station_maintenance;
begin
  if p_status not in ('agendada', 'em_andamento', 'concluida', 'cancelada') then
    raise exception 'Status de manutenção inválido.';
  end if;

  if p_station_id is null then
    raise exception 'Equipamento obrigatório.';
  end if;

  insert into public.arena_station_maintenance (
    station_id,
    title,
    description,
    status,
    started_at,
    expected_end_at,
    internal_notes
  )
  values (
    p_station_id,
    trim(coalesce(nullif(p_title, ''), 'Manutenção')),
    trim(coalesce(p_description, '')),
    p_status,
    coalesce(p_started_at, now()),
    p_expected_end_at,
    trim(coalesce(p_internal_notes, ''))
  )
  returning * into v_row;

  if p_status in ('agendada', 'em_andamento') then
    update public.arena_stations
      set availability_status = 'manutencao'
      where id = p_station_id;
  end if;

  return next v_row;
end;
$$;

create or replace function public.finish_arena_station_maintenance(p_maintenance_id uuid)
returns setof public.arena_station_maintenance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.arena_station_maintenance;
begin
  update public.arena_station_maintenance
    set status = 'concluida', ended_at = now()
    where id = p_maintenance_id
    returning * into v_row;

  if not found then
    raise exception 'Manutenção não encontrada.';
  end if;

  if not exists (
    select 1 from public.arena_station_maintenance maintenance
    where maintenance.station_id = v_row.station_id
      and maintenance.id <> v_row.id
      and maintenance.status in ('agendada', 'em_andamento')
  ) then
    update public.arena_stations
      set availability_status = case when active then 'disponivel' else 'inativo' end
      where id = v_row.station_id;
  end if;

  return next v_row;
end;
$$;

create or replace function public.cancel_arena_station_maintenance(p_maintenance_id uuid)
returns setof public.arena_station_maintenance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.arena_station_maintenance;
begin
  update public.arena_station_maintenance
    set status = 'cancelada', ended_at = now()
    where id = p_maintenance_id
    returning * into v_row;

  if not found then
    raise exception 'Manutenção não encontrada.';
  end if;

  if not exists (
    select 1 from public.arena_station_maintenance maintenance
    where maintenance.station_id = v_row.station_id
      and maintenance.id <> v_row.id
      and maintenance.status in ('agendada', 'em_andamento')
  ) then
    update public.arena_stations
      set availability_status = case when active then 'disponivel' else 'inativo' end
      where id = v_row.station_id;
  end if;

  return next v_row;
end;
$$;

alter table public.arena_stations disable row level security;
alter table public.arena_settings disable row level security;
alter table public.arena_reservations disable row level security;
alter table public.arena_packages disable row level security;
alter table public.arena_customers disable row level security;
alter table public.arena_monthly_plans disable row level security;
alter table public.arena_customer_subscriptions disable row level security;
alter table public.arena_credit_movements disable row level security;
alter table public.arena_station_maintenance disable row level security;
alter table public.admin_notifications disable row level security;
