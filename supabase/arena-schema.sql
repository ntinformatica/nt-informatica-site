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

create index if not exists arena_stations_active_idx
  on public.arena_stations(active, sort_order);

create index if not exists arena_reservations_lookup_idx
  on public.arena_reservations(reservation_date, station_id, status, start_time, end_time);

create index if not exists arena_packages_active_idx
  on public.arena_packages(active, sort_order);

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

create or replace function public.create_arena_reservation(
  p_station_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_reservation_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_notes text default null
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
    notes
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
    nullif(trim(coalesce(p_notes, '')), '')
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

alter table public.arena_stations disable row level security;
alter table public.arena_settings disable row level security;
alter table public.arena_reservations disable row level security;
alter table public.arena_packages disable row level security;
