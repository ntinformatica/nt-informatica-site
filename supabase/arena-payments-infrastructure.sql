begin;

-- NT Arena Gamer - infraestrutura para pagamentos futuros.
-- Execute manualmente no Supabase SQL Editor depois de revisar.
-- Esta migration nao integra gateway de pagamento e nao aprova pagamentos automaticamente.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
declare
  v_missing text;
begin
  select string_agg(dependency_name, ', ' order by dependency_name)
    into v_missing
    from (
      values
        ('table public.arena_settings', to_regclass('public.arena_settings') is not null),
        ('table public.arena_reservations', to_regclass('public.arena_reservations') is not null),
        ('table public.arena_stations', to_regclass('public.arena_stations') is not null),
        ('table public.arena_packages', to_regclass('public.arena_packages') is not null),
        ('table public.arena_customers', to_regclass('public.arena_customers') is not null),
        ('table public.arena_customer_subscriptions', to_regclass('public.arena_customer_subscriptions') is not null),
        ('table public.arena_credit_movements', to_regclass('public.arena_credit_movements') is not null),
        ('table public.arena_station_maintenance', to_regclass('public.arena_station_maintenance') is not null),
        ('function public.is_admin()', to_regprocedure('public.is_admin()') is not null),
        ('function public.normalize_arena_phone(text)', to_regprocedure('public.normalize_arena_phone(text)') is not null),
        ('function public.consume_arena_credits(uuid)', to_regprocedure('public.consume_arena_credits(uuid)') is not null),
        ('function public.refund_arena_credits(uuid)', to_regprocedure('public.refund_arena_credits(uuid)') is not null),
        ('function public.set_updated_at()', to_regprocedure('public.set_updated_at()') is not null)
    ) as dependency(dependency_name, exists_in_database)
    where exists_in_database is false;

  if v_missing is not null then
    raise exception 'Dependencias obrigatorias da Arena nao encontradas antes da migration de pagamentos: %. Execute/revise arena-schema.sql e security-rls.sql antes desta migration.', v_missing;
  end if;
end;
$$;

alter table public.arena_settings
  add column if not exists pending_payment_expiration_minutes integer not null default 15;

alter table public.arena_settings
  drop constraint if exists arena_settings_pending_payment_expiration_check;

alter table public.arena_settings
  add constraint arena_settings_pending_payment_expiration_check
  check (pending_payment_expiration_minutes between 1 and 120);

alter table public.arena_reservations
  add column if not exists expires_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text not null default '',
  add column if not exists active_payment_id uuid,
  add column if not exists blocks_schedule boolean not null default false;

alter table public.arena_reservations
  drop constraint if exists arena_reservations_status_check;

alter table public.arena_reservations
  add constraint arena_reservations_status_check
  check (status in ('pendente', 'pendente_pagamento', 'confirmado', 'cancelado', 'concluido', 'bloqueado', 'expirado'));

create table if not exists public.arena_payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.arena_reservations(id) on delete restrict,
  customer_id uuid references public.arena_customers(id) on delete set null,
  subscription_id uuid references public.arena_customer_subscriptions(id) on delete set null,
  payment_type text not null default 'reservation',
  payment_method text not null default 'manual',
  provider text not null default 'manual',
  provider_payment_id text,
  provider_reference text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'BRL',
  status text not null default 'created',
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  refunded_at timestamptz,
  refunded_amount numeric(12,2) not null default 0,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  manual_confirmed_by uuid references auth.users(id) on delete set null,
  manual_confirmation_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arena_payments_amount_check check (amount >= 0),
  constraint arena_payments_refunded_amount_check check (refunded_amount >= 0 and refunded_amount <= amount),
  constraint arena_payments_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint arena_payments_payment_type_check check (payment_type in ('reservation', 'subscription', 'credits', 'manual_adjustment')),
  constraint arena_payments_payment_method_check check (payment_method in ('manual', 'pix', 'card', 'cash', 'store', 'plan', 'unknown')),
  constraint arena_payments_status_check check (status in ('created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'expired', 'partially_refunded', 'refunded')),
  constraint arena_payments_target_check check (
    reservation_id is not null
    or subscription_id is not null
    or customer_id is not null
  )
);

alter table public.arena_payments
  add column if not exists expired_at timestamptz,
  add column if not exists refunded_amount numeric(12,2) not null default 0;

alter table public.arena_payments
  drop constraint if exists arena_payments_refunded_amount_check;

alter table public.arena_payments
  add constraint arena_payments_refunded_amount_check
  check (refunded_amount >= 0 and refunded_amount <= amount);

create table if not exists public.arena_payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.arena_payments(id) on delete restrict,
  provider text not null default 'internal',
  provider_event_id text,
  event_type text not null,
  event_status text not null default '',
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text not null default '',
  created_at timestamptz not null default now()
);

alter table public.arena_reservations
  drop constraint if exists arena_reservations_active_payment_id_fkey;

alter table public.arena_reservations
  add constraint arena_reservations_active_payment_id_fkey
  foreign key (active_payment_id) references public.arena_payments(id) on delete set null;

create unique index if not exists arena_payments_idempotency_key_uidx
  on public.arena_payments(idempotency_key)
  where idempotency_key is not null and btrim(idempotency_key) <> '';

create unique index if not exists arena_payments_provider_payment_uidx
  on public.arena_payments(provider, provider_payment_id)
  where provider_payment_id is not null and btrim(provider_payment_id) <> '';

create unique index if not exists arena_payment_events_provider_event_uidx
  on public.arena_payment_events(provider, provider_event_id)
  where provider_event_id is not null and btrim(provider_event_id) <> '';

create index if not exists arena_payments_reservation_idx
  on public.arena_payments(reservation_id, status, created_at desc);

create index if not exists arena_payments_customer_idx
  on public.arena_payments(customer_id, status, created_at desc);

create index if not exists arena_payments_status_expires_idx
  on public.arena_payments(status, expires_at)
  where status in ('created', 'pending', 'processing');

create index if not exists arena_payment_events_payment_idx
  on public.arena_payment_events(payment_id, created_at desc);

create index if not exists arena_reservations_expires_idx
  on public.arena_reservations(status, expires_at)
  where status = 'pendente_pagamento';

create or replace function public.set_arena_payment_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arena_payments_set_updated_at on public.arena_payments;
create trigger arena_payments_set_updated_at
before update on public.arena_payments
for each row execute function public.set_arena_payment_updated_at();

create or replace function public.arena_reservation_blocks_schedule(p_status text, p_session_status text, p_expires_at timestamptz)
returns boolean
language sql
stable
as $$
  select
    (
      p_status in ('pendente', 'confirmado', 'bloqueado')
      or (
        p_status = 'pendente_pagamento'
        and (p_expires_at is null or p_expires_at > now())
      )
      or coalesce(p_session_status, '') in ('em_andamento', 'pausada')
    )
    and coalesce(p_status, '') not in ('cancelado', 'concluido', 'expirado');
$$;

create or replace function public.set_arena_reservation_blocks_schedule()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.blocks_schedule := public.arena_reservation_blocks_schedule(new.status, new.session_status, new.expires_at);
  return new;
end;
$$;

drop trigger if exists arena_reservations_set_blocks_schedule on public.arena_reservations;
create trigger arena_reservations_set_blocks_schedule
before insert or update of status, session_status, expires_at
on public.arena_reservations
for each row execute function public.set_arena_reservation_blocks_schedule();

update public.arena_payments
  set
    status = 'expired',
    expired_at = coalesce(expired_at, now())
  where status in ('created', 'pending', 'processing')
    and expires_at is not null
    and expires_at <= now();

update public.arena_reservations reservation
  set
    status = 'expirado',
    expired_at = coalesce(reservation.expired_at, now()),
    cancellation_reason = case
      when reservation.cancellation_reason = '' then 'Pre-reserva expirada automaticamente antes da criacao da constraint.'
      else reservation.cancellation_reason
    end
  where reservation.status = 'pendente_pagamento'
    and reservation.expires_at is not null
    and reservation.expires_at <= now()
    and not exists (
      select 1
        from public.arena_payments payment
        where payment.reservation_id = reservation.id
          and payment.status = 'paid'
    );

update public.arena_reservations
  set blocks_schedule = public.arena_reservation_blocks_schedule(status, session_status, expires_at);

create or replace function public.lock_arena_station_day(p_station_id uuid, p_reservation_date date)
returns void
language plpgsql
as $$
begin
  if p_station_id is null or p_reservation_date is null then
    raise exception 'Equipamento e data sao obrigatorios.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_station_id::text), hashtext(p_reservation_date::text));
end;
$$;

create or replace function public.arena_reservation_has_conflict(
  p_station_id uuid,
  p_reservation_date date,
  p_start_time time,
  p_end_time time,
  p_ignore_reservation_id uuid default null
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.arena_reservations reservation
      where reservation.station_id = p_station_id
        and reservation.reservation_date = p_reservation_date
        and (p_ignore_reservation_id is null or reservation.id <> p_ignore_reservation_id)
        and reservation.blocks_schedule is true
        and reservation.start_time < p_end_time
        and reservation.end_time > p_start_time
  );
$$;

do $$
declare
  v_conflicts text;
begin
  select string_agg(
    format(
      'station_id=%s, reservation_date=%s, a=%s [%s-%s, status=%s, session=%s], b=%s [%s-%s, status=%s, session=%s]',
      a.station_id,
      a.reservation_date,
      a.id,
      a.start_time,
      a.end_time,
      a.status,
      a.session_status,
      b.id,
      b.start_time,
      b.end_time,
      b.status,
      b.session_status
    ),
    E'\n'
  )
    into v_conflicts
    from public.arena_reservations a
    join public.arena_reservations b on b.station_id = a.station_id
     and b.reservation_date = a.reservation_date
     and b.id > a.id
     and a.blocks_schedule is true
     and b.blocks_schedule is true
     and a.start_time < b.end_time
     and a.end_time > b.start_time;

  if v_conflicts is not null then
    raise exception 'Existem reservas bloqueantes sobrepostas. Resolva os conflitos antes de aplicar a constraint arena_reservations_no_overlap:%', E'\n' || v_conflicts;
  end if;
end;
$$;

alter table public.arena_reservations
  drop constraint if exists arena_reservations_no_overlap;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conname = 'arena_reservations_no_overlap'
        and conrelid = 'public.arena_reservations'::regclass
  ) then
    alter table public.arena_reservations
      add constraint arena_reservations_no_overlap
      exclude using gist (
        station_id with =,
        tsrange(
          (reservation_date + start_time),
          (reservation_date + end_time),
          '[)'
        ) with &&
      )
      where (blocks_schedule is true);
  end if;
end;
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
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer public.arena_customers;
begin
  v_phone := public.normalize_arena_phone(p_phone);

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Nome obrigatorio.';
  end if;

  if nullif(v_phone, '') is null then
    raise exception 'WhatsApp obrigatorio.';
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

create or replace function public.expire_arena_pending_reservations()
returns table (
  expired_reservations integer,
  expired_payments integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired_reservations integer := 0;
  v_expired_payments integer := 0;
begin
  insert into public.arena_payment_events (
    payment_id,
    provider,
    provider_event_id,
    event_type,
    event_status,
    payload,
    processed,
    processed_at
  )
  select
    payment.id,
    'internal',
    payment.id::text || ':expired',
    'payment.expired',
    'expired',
    jsonb_build_object('reason', 'automatic_expiration', 'expired_at', now()),
    true,
    now()
  from public.arena_payments payment
  where payment.status in ('created', 'pending', 'processing')
    and payment.expires_at is not null
    and payment.expires_at <= now()
  on conflict (provider, provider_event_id) where provider_event_id is not null and btrim(provider_event_id) <> '' do nothing;

  update public.arena_payments payment
    set
      status = 'expired',
      expired_at = coalesce(payment.expired_at, now())
    where payment.status in ('created', 'pending', 'processing')
      and payment.expires_at is not null
      and payment.expires_at <= now();
  get diagnostics v_expired_payments = row_count;

  update public.arena_reservations reservation
    set
      status = 'expirado',
      expired_at = coalesce(reservation.expired_at, now()),
      cancellation_reason = case
        when reservation.cancellation_reason = '' then 'Pre-reserva expirada automaticamente.'
        else reservation.cancellation_reason
      end
    where reservation.status = 'pendente_pagamento'
      and reservation.expires_at is not null
      and reservation.expires_at <= now()
      and not exists (
        select 1
          from public.arena_payments payment
          where payment.reservation_id = reservation.id
            and payment.status = 'paid'
      );
  get diagnostics v_expired_reservations = row_count;

  expired_reservations := v_expired_reservations;
  expired_payments := v_expired_payments;
  return next;
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
set search_path = public, pg_temp
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
  perform public.expire_arena_pending_reservations();
  perform public.lock_arena_station_day(p_station_id, p_reservation_date);

  if p_station_id is null then
    raise exception 'Equipamento obrigatorio.';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Nome obrigatorio.';
  end if;

  if nullif(trim(coalesce(p_customer_phone, '')), '') is null then
    raise exception 'WhatsApp obrigatorio.';
  end if;

  if p_reservation_date is null or p_start_time is null then
    raise exception 'Data e horario sao obrigatorios.';
  end if;

  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duracao invalida.';
  end if;

  select * into v_settings
    from public.arena_settings
    order by created_at asc
    limit 1;

  if not found then
    raise exception 'Configuracao da Arena nao encontrada.';
  end if;

  select * into v_station
    from public.arena_stations
    where id = p_station_id and active = true;

  if not found or v_station.availability_status in ('manutencao', 'inativo') then
    raise exception 'Equipamento indisponivel.';
  end if;

  v_day := extract(dow from p_reservation_date)::integer;
  if not (v_day = any(v_settings.active_days)) then
    raise exception 'A Arena nao atende neste dia.';
  end if;

  v_end_time := (p_start_time + make_interval(mins => p_duration_minutes))::time;
  if v_end_time <= p_start_time then
    raise exception 'Horario final invalido.';
  end if;

  if p_start_time < v_settings.opening_time or v_end_time > v_settings.closing_time then
    raise exception 'Horario fora do funcionamento da Arena.';
  end if;

  if public.arena_reservation_has_conflict(p_station_id, p_reservation_date, p_start_time, v_end_time, null) then
    raise exception 'Horario indisponivel.';
  end if;

  if exists (
    select 1
      from public.arena_station_maintenance maintenance
      where maintenance.station_id = p_station_id
        and maintenance.status in ('agendada', 'em_andamento')
        and maintenance.started_at < ((p_reservation_date + v_end_time)::timestamptz)
        and coalesce(maintenance.expected_end_at, 'infinity'::timestamptz) > ((p_reservation_date + p_start_time)::timestamptz)
  ) then
    raise exception 'Equipamento em manutencao neste periodo.';
  end if;

  select * into v_customer
    from public.create_or_find_arena_customer(p_customer_name, p_customer_phone);

  if coalesce(p_payment_type, 'avulso') = 'plano' then
    if p_subscription_id is not null then
      select * into v_subscription
        from public.arena_customer_subscriptions
        where id = p_subscription_id
          and customer_id = v_customer.id
        for update;
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
        limit 1
        for update of subscription;
    end if;

    if not found then
      raise exception 'Plano mensal expirado ou saldo de horas insuficiente para esta reserva.';
    end if;

    if v_subscription.status <> 'ativo' or v_subscription.expiration_date < current_date or v_subscription.remaining_minutes < p_duration_minutes then
      raise exception 'Plano mensal expirado ou saldo de horas insuficiente para esta reserva.';
    end if;
  end if;

  select * into v_package
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
    payment_type,
    expires_at
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
    case when coalesce(p_payment_type, 'avulso') = 'plano' then 'plano' else 'avulso' end,
    null
  )
  returning * into v_row;

  return next v_row;
end;
$$;

create or replace function public.create_arena_pre_reservation(
  p_station_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_reservation_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_notes text default null,
  p_payment_method text default 'pix',
  p_idempotency_key text default null,
  p_subscription_id uuid default null
)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.arena_settings;
  v_station public.arena_stations;
  v_end_time time;
  v_total_price numeric(10,2);
  v_row public.arena_reservations;
  v_payment public.arena_payments;
  v_day integer;
  v_package public.arena_packages;
  v_customer public.arena_customers;
  v_expires_at timestamptz;
begin
  perform public.expire_arena_pending_reservations();

  if nullif(trim(coalesce(p_idempotency_key, '')), '') is not null then
    select reservation.*
      into v_row
      from public.arena_payments payment
      join public.arena_reservations reservation on reservation.id = payment.reservation_id
      where payment.idempotency_key = trim(p_idempotency_key)
      limit 1;

    if found then
      return next v_row;
      return;
    end if;
  end if;

  perform public.lock_arena_station_day(p_station_id, p_reservation_date);

  select * into v_settings
    from public.arena_settings
    order by created_at asc
    limit 1;

  if not found then
    raise exception 'Configuracao da Arena nao encontrada.';
  end if;

  select * into v_station
    from public.arena_stations
    where id = p_station_id and active = true;

  if not found or v_station.availability_status in ('manutencao', 'inativo') then
    raise exception 'Equipamento indisponivel.';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Nome obrigatorio.';
  end if;

  if nullif(trim(coalesce(p_customer_phone, '')), '') is null then
    raise exception 'WhatsApp obrigatorio.';
  end if;

  if p_reservation_date is null or p_start_time is null then
    raise exception 'Data e horario sao obrigatorios.';
  end if;

  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duracao invalida.';
  end if;

  v_day := extract(dow from p_reservation_date)::integer;
  if not (v_day = any(v_settings.active_days)) then
    raise exception 'A Arena nao atende neste dia.';
  end if;

  v_end_time := (p_start_time + make_interval(mins => p_duration_minutes))::time;
  if v_end_time <= p_start_time then
    raise exception 'Horario final invalido.';
  end if;

  if p_start_time < v_settings.opening_time or v_end_time > v_settings.closing_time then
    raise exception 'Horario fora do funcionamento da Arena.';
  end if;

  if public.arena_reservation_has_conflict(p_station_id, p_reservation_date, p_start_time, v_end_time, null) then
    raise exception 'Horario indisponivel.';
  end if;

  select * into v_customer
    from public.create_or_find_arena_customer(p_customer_name, p_customer_phone);

  if p_subscription_id is not null then
    raise exception 'Pre-reserva de pagamento online nao aceita assinatura mensal. Use o fluxo de reserva por plano.';
  end if;

  select * into v_package
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

  v_expires_at := now() + make_interval(mins => greatest(1, coalesce(v_settings.pending_payment_expiration_minutes, 15)));

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
    payment_type,
    expires_at
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
    'pendente_pagamento',
    nullif(trim(coalesce(p_notes, '')), ''),
    v_customer.id,
    p_subscription_id,
    'avulso',
    v_expires_at
  )
  returning * into v_row;

  insert into public.arena_payments (
    reservation_id,
    customer_id,
    subscription_id,
    payment_type,
    payment_method,
    provider,
    amount,
    currency,
    status,
    expires_at,
    idempotency_key,
    metadata
  )
  values (
    v_row.id,
    v_customer.id,
    p_subscription_id,
    'reservation',
    coalesce(nullif(trim(p_payment_method), ''), 'pix'),
    'pending_provider',
    v_total_price,
    'BRL',
    'created',
    v_expires_at,
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    jsonb_build_object('source', 'public_pre_reservation')
  )
  returning * into v_payment;

  update public.arena_reservations
    set active_payment_id = v_payment.id
    where id = v_row.id
    returning * into v_row;

  insert into public.arena_payment_events (
    payment_id,
    provider,
    provider_event_id,
    event_type,
    event_status,
    payload,
    processed,
    processed_at
  )
  values (
    v_payment.id,
    'internal',
    v_payment.id::text || ':created',
    'payment.created',
    'created',
    jsonb_build_object('reservation_id', v_row.id, 'expires_at', v_expires_at),
    true,
    now()
  )
  on conflict (provider, provider_event_id) where provider_event_id is not null and btrim(provider_event_id) <> '' do nothing;

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
set search_path = public, pg_temp
as $$
declare
  v_station public.arena_stations;
  v_row public.arena_reservations;
  v_duration integer;
begin
  if not public.arena_is_admin_or_service() then
    raise exception 'Acesso negado.';
  end if;

  perform public.expire_arena_pending_reservations();
  perform public.lock_arena_station_day(p_station_id, p_reservation_date);

  if p_station_id is null or p_reservation_date is null or p_start_time is null or p_end_time is null then
    raise exception 'Equipamento, data, inicio e fim sao obrigatorios.';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'Horario final invalido.';
  end if;

  select * into v_station
    from public.arena_stations
    where id = p_station_id and active = true;

  if not found or v_station.availability_status in ('manutencao', 'inativo') then
    raise exception 'Equipamento indisponivel.';
  end if;

  if public.arena_reservation_has_conflict(p_station_id, p_reservation_date, p_start_time, p_end_time, null) then
    raise exception 'Horario indisponivel.';
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
    and public.arena_reservation_blocks_schedule(reservation.status, reservation.session_status, reservation.expires_at);
$$;

create or replace function public.arena_is_admin_or_service()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.is_admin(), false)
    or coalesce(auth.role(), '') = 'service_role'
    or current_user = 'service_role'
    or current_setting('request.jwt.claim.role', true) = 'service_role';
$$;

create or replace function public.create_arena_payment(
  p_reservation_id uuid default null,
  p_customer_id uuid default null,
  p_subscription_id uuid default null,
  p_payment_type text default 'reservation',
  p_payment_method text default 'manual',
  p_provider text default 'manual',
  p_provider_payment_id text default null,
  p_provider_reference text default null,
  p_amount numeric default 0,
  p_currency text default 'BRL',
  p_status text default 'created',
  p_expires_at timestamptz default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.arena_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.arena_payments;
  v_reservation public.arena_reservations;
begin
  if not public.arena_is_admin_or_service() then
    raise exception 'Acesso negado.';
  end if;

  if coalesce(p_amount, 0) < 0 then
    raise exception 'Valor de pagamento invalido.';
  end if;

  if p_status not in ('created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'expired') then
    raise exception 'Status de pagamento invalido.';
  end if;

  if p_reservation_id is not null then
    select * into v_reservation
      from public.arena_reservations
      where id = p_reservation_id
      for update;

    if not found then
      raise exception 'Reserva vinculada ao pagamento nao encontrada.';
    end if;

    p_customer_id := coalesce(p_customer_id, v_reservation.customer_id);
    p_subscription_id := coalesce(p_subscription_id, v_reservation.subscription_id);
  end if;

  if nullif(trim(coalesce(p_idempotency_key, '')), '') is not null then
    select * into v_payment
      from public.arena_payments
      where idempotency_key = trim(p_idempotency_key)
      limit 1;

    if found then
      return next v_payment;
      return;
    end if;
  end if;

  insert into public.arena_payments (
    reservation_id,
    customer_id,
    subscription_id,
    payment_type,
    payment_method,
    provider,
    provider_payment_id,
    provider_reference,
    amount,
    currency,
    status,
    expires_at,
    idempotency_key,
    metadata
  )
  values (
    p_reservation_id,
    p_customer_id,
    p_subscription_id,
    coalesce(nullif(trim(p_payment_type), ''), 'reservation'),
    coalesce(nullif(trim(p_payment_method), ''), 'manual'),
    coalesce(nullif(trim(p_provider), ''), 'manual'),
    nullif(trim(coalesce(p_provider_payment_id, '')), ''),
    nullif(trim(coalesce(p_provider_reference, '')), ''),
    coalesce(p_amount, 0),
    upper(coalesce(nullif(trim(p_currency), ''), 'BRL')),
    coalesce(nullif(trim(p_status), ''), 'created'),
    p_expires_at,
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_payment;

  if v_payment.reservation_id is not null then
    update public.arena_reservations
      set active_payment_id = v_payment.id
      where id = v_payment.reservation_id
        and active_payment_id is null;
  end if;

  return next v_payment;
end;
$$;

create or replace function public.confirm_arena_payment(
  p_payment_id uuid,
  p_provider_event_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_manual_reason text default ''
)
returns setof public.arena_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.arena_payments;
  v_reservation public.arena_reservations;
  v_event_id uuid;
begin
  if not public.arena_is_admin_or_service() then
    raise exception 'Acesso negado.';
  end if;

  select * into v_payment
    from public.arena_payments
    where id = p_payment_id
    for update;

  if not found then
    raise exception 'Pagamento nao encontrado.';
  end if;

  if nullif(trim(coalesce(p_provider_event_id, '')), '') is not null then
    insert into public.arena_payment_events (
      payment_id,
      provider,
      provider_event_id,
      event_type,
      event_status,
      payload,
      processed,
      processed_at
    )
    values (
      v_payment.id,
      v_payment.provider,
      trim(p_provider_event_id),
      'payment.confirmed',
      'paid',
      coalesce(p_metadata, '{}'::jsonb),
      true,
      now()
    )
    on conflict (provider, provider_event_id) where provider_event_id is not null and btrim(provider_event_id) <> '' do nothing
    returning id into v_event_id;

    if v_event_id is null then
      if v_payment.status = 'paid' then
        return next v_payment;
        return;
      end if;

      raise exception 'Evento de pagamento duplicado recebido antes da confirmacao do pagamento.';
    end if;
  end if;

  if v_payment.status = 'paid' then
    return next v_payment;
    return;
  end if;

  if v_payment.status not in ('created', 'pending', 'processing') then
    raise exception 'Pagamento com status % nao pode ser confirmado.', v_payment.status;
  end if;

  if v_payment.amount < 0 then
    raise exception 'Valor de pagamento invalido.';
  end if;

  if v_payment.reservation_id is not null then
    select * into v_reservation
      from public.arena_reservations
      where id = v_payment.reservation_id
      for update;

    if found then
      perform public.lock_arena_station_day(v_reservation.station_id, v_reservation.reservation_date);

      if v_reservation.status in ('cancelado', 'concluido', 'expirado') then
        raise exception 'Reserva com status % nao pode ser confirmada automaticamente.', v_reservation.status;
      end if;

      if v_reservation.status = 'pendente_pagamento'
        and v_reservation.expires_at is not null
        and v_reservation.expires_at <= now()
      then
        raise exception 'Pre-reserva expirada. Confirme manualmente somente apos validar disponibilidade.';
      end if;

      if public.arena_reservation_has_conflict(
        v_reservation.station_id,
        v_reservation.reservation_date,
        v_reservation.start_time,
        v_reservation.end_time,
        v_reservation.id
      ) then
        raise exception 'Horario da reserva ficou indisponivel antes da confirmacao do pagamento.';
      end if;
    else
      raise exception 'Reserva vinculada ao pagamento nao encontrada.';
    end if;
  end if;

  update public.arena_payments
    set
      status = 'paid',
      paid_at = coalesce(paid_at, now()),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
      manual_confirmed_by = case when v_payment.provider = 'manual' then auth.uid() else manual_confirmed_by end,
      manual_confirmation_reason = case
        when v_payment.provider = 'manual' then trim(coalesce(p_manual_reason, ''))
        else manual_confirmation_reason
      end
    where id = v_payment.id
    returning * into v_payment;

  if v_payment.reservation_id is not null then
      if v_reservation.payment_type = 'plano' and not v_reservation.credits_processed then
        perform public.consume_arena_credits(v_reservation.id);
      end if;

      update public.arena_reservations
        set
          status = case when status in ('pendente', 'pendente_pagamento') then 'confirmado' else status end,
          active_payment_id = v_payment.id,
          expires_at = null
        where id = v_reservation.id;
  end if;

  return next v_payment;
end;
$$;

create or replace function public.fail_arena_payment(
  p_payment_id uuid,
  p_status text default 'failed',
  p_provider_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.arena_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.arena_payments;
  v_next_status text;
begin
  if not public.arena_is_admin_or_service() then
    raise exception 'Acesso negado.';
  end if;

  v_next_status := coalesce(nullif(trim(p_status), ''), 'failed');
  if v_next_status not in ('failed', 'cancelled', 'expired') then
    raise exception 'Status de falha invalido.';
  end if;

  select * into v_payment
    from public.arena_payments
    where id = p_payment_id
    for update;

  if not found then
    raise exception 'Pagamento nao encontrado.';
  end if;

  if v_payment.status in ('paid', 'partially_refunded', 'refunded') then
    raise exception 'Pagamento liquidado ou reembolsado nao pode ser marcado como falha por esta funcao.';
  end if;

  update public.arena_payments
    set
      status = v_next_status,
      cancelled_at = case when v_next_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
      expired_at = case when v_next_status = 'expired' then coalesce(expired_at, now()) else expired_at end,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
    where id = v_payment.id
    returning * into v_payment;

  if v_payment.reservation_id is not null and v_next_status in ('cancelled', 'expired') then
    update public.arena_reservations
      set
        status = case when v_next_status = 'expired' then 'expirado' else 'cancelado' end,
        expired_at = case when v_next_status = 'expired' then coalesce(expired_at, now()) else expired_at end,
        cancelled_at = case when v_next_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
        cancellation_reason = case
          when cancellation_reason = '' then 'Pagamento ' || v_next_status || '.'
          else cancellation_reason
        end
      where id = v_payment.reservation_id
        and status in ('pendente_pagamento', 'pendente');
  end if;

  insert into public.arena_payment_events (
    payment_id,
    provider,
    provider_event_id,
    event_type,
    event_status,
    payload,
    processed,
    processed_at
  )
  values (
    v_payment.id,
    v_payment.provider,
    nullif(trim(coalesce(p_provider_event_id, '')), ''),
    'payment.' || v_next_status,
    v_next_status,
    coalesce(p_metadata, '{}'::jsonb),
    true,
    now()
  )
  on conflict (provider, provider_event_id) where provider_event_id is not null and btrim(provider_event_id) <> '' do nothing;

  return next v_payment;
end;
$$;

create or replace function public.expire_arena_payment(p_payment_id uuid)
returns setof public.arena_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.fail_arena_payment(p_payment_id, 'expired', null, jsonb_build_object('reason', 'manual_or_scheduled_expiration'));
end;
$$;

create or replace function public.cancel_arena_payment(p_payment_id uuid, p_reason text default '')
returns setof public.arena_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.fail_arena_payment(p_payment_id, 'cancelled', null, jsonb_build_object('reason', coalesce(p_reason, '')));
end;
$$;

create or replace function public.refund_arena_payment(
  p_payment_id uuid,
  p_amount numeric default null,
  p_reason text default ''
)
returns setof public.arena_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.arena_payments;
  v_status text;
  v_refund_amount numeric(12,2);
  v_new_refunded_amount numeric(12,2);
begin
  if not public.arena_is_admin_or_service() then
    raise exception 'Acesso negado.';
  end if;

  select * into v_payment
    from public.arena_payments
    where id = p_payment_id
    for update;

  if not found then
    raise exception 'Pagamento nao encontrado.';
  end if;

  if v_payment.status not in ('paid', 'partially_refunded') then
    raise exception 'Somente pagamentos pagos podem ser reembolsados.';
  end if;

  v_refund_amount := coalesce(p_amount, v_payment.amount - coalesce(v_payment.refunded_amount, 0));

  if v_refund_amount <= 0 then
    raise exception 'Valor de reembolso invalido.';
  end if;

  if coalesce(v_payment.refunded_amount, 0) + v_refund_amount > v_payment.amount then
    raise exception 'Valor de reembolso ultrapassa o valor pago restante.';
  end if;

  v_new_refunded_amount := coalesce(v_payment.refunded_amount, 0) + v_refund_amount;

  v_status := case
    when v_new_refunded_amount < v_payment.amount then 'partially_refunded'
    else 'refunded'
  end;

  update public.arena_payments
    set
      status = v_status,
      refunded_at = coalesce(refunded_at, now()),
      refunded_amount = v_new_refunded_amount,
      metadata = metadata || jsonb_build_object(
        'last_refund_amount',
        v_refund_amount,
        'refunded_amount',
        v_new_refunded_amount,
        'refund_reason',
        coalesce(p_reason, '')
      )
    where id = v_payment.id
    returning * into v_payment;

  insert into public.arena_payment_events (
    payment_id,
    provider,
    provider_event_id,
    event_type,
    event_status,
    payload,
    processed,
    processed_at
  )
  values (
    v_payment.id,
    'internal',
    v_payment.id::text || ':refund:' || extract(epoch from now())::bigint::text,
    'payment.refunded',
    v_status,
    jsonb_build_object('amount', v_refund_amount, 'refunded_amount', v_new_refunded_amount, 'reason', coalesce(p_reason, '')),
    true,
    now()
  );

  return next v_payment;
end;
$$;

create or replace function public.update_arena_reservation_status(
  p_reservation_id uuid,
  p_status text
)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.arena_reservations;
begin
  if not public.arena_is_admin_or_service() then
    raise exception 'Acesso negado.';
  end if;

  if p_status not in ('pendente', 'pendente_pagamento', 'confirmado', 'cancelado', 'concluido', 'bloqueado', 'expirado') then
    raise exception 'Status invalido.';
  end if;

  select * into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva nao encontrada.';
  end if;

  perform public.lock_arena_station_day(v_reservation.station_id, v_reservation.reservation_date);

  if p_status = 'confirmado' then
    perform public.consume_arena_credits(p_reservation_id);
  elsif p_status = 'cancelado' then
    perform public.refund_arena_credits(p_reservation_id);
  end if;

  update public.arena_reservations
    set
      status = p_status,
      cancelled_at = case when p_status = 'cancelado' then coalesce(cancelled_at, now()) else cancelled_at end,
      expired_at = case when p_status = 'expirado' then coalesce(expired_at, now()) else expired_at end
    where id = p_reservation_id
    returning * into v_reservation;

  return next v_reservation;
end;
$$;

create or replace function public.delete_arena_reservation_safe(p_reservation_id uuid)
returns setof public.arena_reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.arena_reservations;
  v_has_financial_history boolean;
begin
  if not public.arena_is_admin_or_service() then
    raise exception 'Acesso negado.';
  end if;

  select * into v_reservation
    from public.arena_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'Reserva nao encontrada.';
  end if;

  v_has_financial_history := exists (
    select 1 from public.arena_payments payment where payment.reservation_id = p_reservation_id
  ) or exists (
    select 1 from public.arena_credit_movements movement where movement.reservation_id = p_reservation_id
  ) or v_reservation.credits_processed = true
    or v_reservation.session_started_at is not null
    or v_reservation.session_ended_at is not null;

  if v_has_financial_history then
    update public.arena_reservations
      set
        status = case when status = 'concluido' then status else 'cancelado' end,
        cancelled_at = coalesce(cancelled_at, now()),
        cancellation_reason = case
          when cancellation_reason = '' then 'Exclusao fisica impedida para preservar historico financeiro.'
          else cancellation_reason
        end
      where id = p_reservation_id
      returning * into v_reservation;

    return next v_reservation;
    return;
  end if;

  delete from public.arena_reservations
    where id = p_reservation_id
    returning * into v_reservation;

  return next v_reservation;
end;
$$;

alter table public.arena_payments enable row level security;
alter table public.arena_payment_events enable row level security;

drop policy if exists arena_reservations_admin_insert on public.arena_reservations;
create policy arena_reservations_admin_insert on public.arena_reservations for insert to authenticated with check (false);

drop policy if exists arena_reservations_admin_delete on public.arena_reservations;
create policy arena_reservations_admin_delete on public.arena_reservations for delete to authenticated using (false);

revoke all on table public.arena_payments, public.arena_payment_events from anon, authenticated;
grant select on table public.arena_payments, public.arena_payment_events to authenticated;
grant all privileges on table public.arena_payments, public.arena_payment_events to service_role;

drop policy if exists arena_payments_admin_select on public.arena_payments;
create policy arena_payments_admin_select on public.arena_payments for select to authenticated using (public.is_admin());
drop policy if exists arena_payments_admin_insert on public.arena_payments;
create policy arena_payments_admin_insert on public.arena_payments for insert to authenticated with check (public.is_admin());
drop policy if exists arena_payments_admin_update on public.arena_payments;
create policy arena_payments_admin_update on public.arena_payments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_payments_admin_delete on public.arena_payments;
create policy arena_payments_admin_delete on public.arena_payments for delete to authenticated using (false);

drop policy if exists arena_payment_events_admin_select on public.arena_payment_events;
create policy arena_payment_events_admin_select on public.arena_payment_events for select to authenticated using (public.is_admin());
drop policy if exists arena_payment_events_admin_insert on public.arena_payment_events;
create policy arena_payment_events_admin_insert on public.arena_payment_events for insert to authenticated with check (public.is_admin());
drop policy if exists arena_payment_events_admin_update on public.arena_payment_events;
create policy arena_payment_events_admin_update on public.arena_payment_events for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_payment_events_admin_delete on public.arena_payment_events;
create policy arena_payment_events_admin_delete on public.arena_payment_events for delete to authenticated using (false);

revoke execute on function public.create_arena_payment(uuid, uuid, uuid, text, text, text, text, text, numeric, text, text, timestamptz, text, jsonb) from anon;
revoke execute on function public.confirm_arena_payment(uuid, text, jsonb, text) from anon;
revoke execute on function public.fail_arena_payment(uuid, text, text, jsonb) from anon;
revoke execute on function public.expire_arena_payment(uuid) from anon;
revoke execute on function public.cancel_arena_payment(uuid, text) from anon;
revoke execute on function public.refund_arena_payment(uuid, numeric, text) from anon;
revoke execute on function public.delete_arena_reservation_safe(uuid) from anon;
revoke execute on function public.expire_arena_pending_reservations() from anon, authenticated;

grant execute on function public.create_arena_reservation(uuid, text, text, date, time, integer, text, text, uuid) to anon, authenticated;
grant execute on function public.create_arena_pre_reservation(uuid, text, text, date, time, integer, text, text, text, uuid) to anon, authenticated;
grant execute on function public.expire_arena_pending_reservations() to service_role;
grant execute on function public.list_public_arena_busy_slots(date) to anon, authenticated;

grant execute on function public.create_arena_payment(uuid, uuid, uuid, text, text, text, text, text, numeric, text, text, timestamptz, text, jsonb) to authenticated, service_role;
grant execute on function public.confirm_arena_payment(uuid, text, jsonb, text) to authenticated, service_role;
grant execute on function public.fail_arena_payment(uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function public.expire_arena_payment(uuid) to authenticated, service_role;
grant execute on function public.cancel_arena_payment(uuid, text) to authenticated, service_role;
grant execute on function public.refund_arena_payment(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.delete_arena_reservation_safe(uuid) to authenticated, service_role;

commit;
