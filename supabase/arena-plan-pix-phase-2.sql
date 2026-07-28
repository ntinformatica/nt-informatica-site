begin;

create extension if not exists pgcrypto;

alter table public.arena_monthly_plans
  add column if not exists identifier text;

update public.arena_monthly_plans
set identifier = case
  when lower(name) = lower('Plano Player') then 'player'
  when lower(name) = lower('Plano Pro') then 'pro'
  when lower(name) = lower('Plano Squad') then 'squad'
  else coalesce(identifier, lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
end
where identifier is null or btrim(identifier) = '';

create unique index if not exists arena_monthly_plans_identifier_uidx
  on public.arena_monthly_plans(identifier)
  where identifier is not null and btrim(identifier) <> '';

insert into public.arena_monthly_plans (
  identifier,
  name,
  price,
  included_minutes,
  validity_days,
  description,
  active,
  sort_order
)
values
  ('player', 'Plano Player', 150.00, 600, 30, 'Pra jogar de vez em quando', true, 1),
  ('pro', 'Plano Pro', 250.00, 1200, 30, 'Mais horas, melhor custo', true, 2),
  ('squad', 'Plano Squad', 400.00, 2400, 30, 'Mais economia e jogatina', true, 3)
on conflict (identifier) where identifier is not null and btrim(identifier) <> '' do update
set
  name = excluded.name,
  price = excluded.price,
  included_minutes = excluded.included_minutes,
  validity_days = excluded.validity_days,
  description = excluded.description,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.arena_plan_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.arena_customers(id) on delete set null,
  subscription_id uuid references public.arena_customer_subscriptions(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_phone_normalized text not null,
  plan_id uuid not null references public.arena_monthly_plans(id),
  plan_identifier text not null,
  plan_name text not null,
  amount numeric(12,2) not null,
  purchased_hours numeric(8,2) not null,
  purchased_minutes integer not null,
  validity_days integer not null,
  status text not null default 'pending',
  provider text not null default 'mercado_pago',
  mercado_pago_order_id text,
  mercado_pago_payment_id text,
  provider_reference text,
  idempotency_key text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  approved_at timestamptz,
  failure_reason text not null default '',
  raw_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arena_plan_payments_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded')),
  constraint arena_plan_payments_amount_check check (amount > 0),
  constraint arena_plan_payments_minutes_check check (purchased_minutes > 0),
  constraint arena_plan_payments_validity_check check (validity_days > 0)
);

create table if not exists public.arena_plan_payment_events (
  id uuid primary key default gen_random_uuid(),
  plan_payment_id uuid references public.arena_plan_payments(id) on delete restrict,
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

create unique index if not exists arena_plan_payments_idempotency_key_uidx
  on public.arena_plan_payments(idempotency_key)
  where idempotency_key is not null and btrim(idempotency_key) <> '';

create unique index if not exists arena_plan_payments_mp_order_uidx
  on public.arena_plan_payments(mercado_pago_order_id)
  where mercado_pago_order_id is not null and btrim(mercado_pago_order_id) <> '';

create unique index if not exists arena_plan_payment_events_provider_event_uidx
  on public.arena_plan_payment_events(provider, provider_event_id)
  where provider_event_id is not null and btrim(provider_event_id) <> '';

create index if not exists arena_plan_payments_customer_idx
  on public.arena_plan_payments(customer_phone_normalized, status, created_at desc);

create index if not exists arena_plan_payments_status_expires_idx
  on public.arena_plan_payments(status, expires_at)
  where status = 'pending';

create index if not exists arena_plan_payment_events_payment_idx
  on public.arena_plan_payment_events(plan_payment_id, created_at desc);

drop trigger if exists arena_plan_payments_set_updated_at on public.arena_plan_payments;
create trigger arena_plan_payments_set_updated_at
before update on public.arena_plan_payments
for each row execute function public.set_updated_at();

create or replace function public.derive_arena_subscription_status(
  p_remaining_minutes integer,
  p_expiration_date date,
  p_current_status text default 'ativo',
  p_low_balance_minutes integer default 180
)
returns text
language sql
stable
as $$
  select case
    when coalesce(p_current_status, 'ativo') in ('suspenso', 'cancelado', 'encerrado') then p_current_status
    when p_expiration_date < current_date then 'expirado'
    when coalesce(p_remaining_minutes, 0) <= 0 then 'encerrado'
    else 'ativo'
  end;
$$;

create or replace function public.create_arena_plan_payment(
  p_plan_identifier text,
  p_customer_name text,
  p_customer_phone text,
  p_idempotency_key text default null
)
returns setof public.arena_plan_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.arena_monthly_plans;
  v_customer public.arena_customers;
  v_payment public.arena_plan_payments;
  v_phone text;
  v_key text;
  v_expires_at timestamptz;
begin
  v_phone := public.normalize_arena_phone(p_customer_phone);
  v_key := nullif(trim(coalesce(p_idempotency_key, '')), '');

  if nullif(trim(coalesce(p_plan_identifier, '')), '') is null then
    raise exception 'Plano obrigatorio.';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Nome obrigatorio.';
  end if;

  if nullif(v_phone, '') is null then
    raise exception 'WhatsApp obrigatorio.';
  end if;

  select *
    into v_plan
    from public.arena_monthly_plans
    where active = true
      and (
        identifier = trim(lower(p_plan_identifier))
        or id::text = trim(p_plan_identifier)
      )
    order by sort_order asc
    limit 1;

  if not found then
    raise exception 'Plano mensal nao encontrado ou inativo.';
  end if;

  select * into v_customer
    from public.create_or_find_arena_customer(p_customer_name, p_customer_phone);

  if v_key is not null then
    select *
      into v_payment
      from public.arena_plan_payments
      where idempotency_key = v_key
        and customer_phone_normalized = v_phone
        and plan_id = v_plan.id
        and status = 'pending'
        and (expires_at is null or expires_at > now())
      order by created_at desc
      limit 1;

    if found then
      return next v_payment;
      return;
    end if;

    update public.arena_plan_payments payment
      set
        idempotency_key = null,
        metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
          'previous_idempotency_key',
          payment.idempotency_key,
          'released_at',
          now(),
          'released_reason',
          'not_reusable_for_plan_pix'
        )
      where payment.idempotency_key = v_key
        and not (
          payment.customer_phone_normalized = v_phone
          and payment.plan_id = v_plan.id
          and payment.status = 'pending'
          and (payment.expires_at is null or payment.expires_at > now())
        );
  end if;

  v_expires_at := now() + interval '15 minutes';

  insert into public.arena_plan_payments (
    customer_id,
    customer_name,
    customer_phone,
    customer_phone_normalized,
    plan_id,
    plan_identifier,
    plan_name,
    amount,
    purchased_hours,
    purchased_minutes,
    validity_days,
    status,
    expires_at,
    idempotency_key,
    metadata
  )
  values (
    v_customer.id,
    trim(p_customer_name),
    trim(p_customer_phone),
    v_phone,
    v_plan.id,
    v_plan.identifier,
    v_plan.name,
    v_plan.price,
    round((v_plan.included_minutes::numeric / 60), 2),
    v_plan.included_minutes,
    v_plan.validity_days,
    'pending',
    v_expires_at,
    v_key,
    jsonb_build_object(
      'source',
      'public_arena_plan_pix',
      'official_plan',
      jsonb_build_object(
        'identifier', v_plan.identifier,
        'name', v_plan.name,
        'price', v_plan.price,
        'included_minutes', v_plan.included_minutes,
        'validity_days', v_plan.validity_days
      )
    )
  )
  returning * into v_payment;

  return next v_payment;
end;
$$;

create or replace function public.confirm_arena_plan_payment(
  p_plan_payment_id uuid,
  p_provider_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.arena_plan_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.arena_plan_payments;
  v_subscription public.arena_customer_subscriptions;
  v_event_id uuid;
  v_previous integer := 0;
  v_new integer := 0;
  v_start_date date := current_date;
  v_expiration_date date;
begin
  select *
    into v_payment
    from public.arena_plan_payments
    where id = p_plan_payment_id
    for update;

  if not found then
    raise exception 'Pagamento de plano nao encontrado.';
  end if;

  if nullif(trim(coalesce(p_provider_event_id, '')), '') is not null then
    insert into public.arena_plan_payment_events (
      plan_payment_id,
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
      'plan_payment.approved',
      'approved',
      coalesce(p_metadata, '{}'::jsonb),
      true,
      now()
    )
    on conflict (provider, provider_event_id) where provider_event_id is not null and btrim(provider_event_id) <> '' do nothing
    returning id into v_event_id;

    if v_event_id is null then
      return next v_payment;
      return;
    end if;
  end if;

  if v_payment.status = 'approved' then
    return next v_payment;
    return;
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Pagamento de plano com status % nao pode ser aprovado.', v_payment.status;
  end if;

  select *
    into v_subscription
    from public.arena_customer_subscriptions
    where customer_id = v_payment.customer_id
      and status = 'ativo'
      and expiration_date >= current_date
    order by expiration_date desc, created_at desc
    limit 1
    for update;

  if found then
    v_previous := v_subscription.remaining_minutes;
    v_new := v_previous + v_payment.purchased_minutes;
    v_expiration_date := v_subscription.expiration_date + v_payment.validity_days;

    update public.arena_customer_subscriptions
      set
        plan_id = v_payment.plan_id,
        expiration_date = v_expiration_date,
        total_minutes = total_minutes + v_payment.purchased_minutes,
        remaining_minutes = v_new,
        status = 'ativo',
        amount_paid = coalesce(amount_paid, 0) + v_payment.amount,
        notes = trim(concat_ws(E'\n', nullif(notes, ''), 'Renovacao via Pix: ' || v_payment.plan_name))
      where id = v_subscription.id
      returning * into v_subscription;
  else
    v_previous := 0;
    v_new := v_payment.purchased_minutes;
    v_expiration_date := current_date + (v_payment.validity_days - 1);

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
      v_payment.customer_id,
      v_payment.plan_id,
      v_start_date,
      v_expiration_date,
      v_payment.purchased_minutes,
      0,
      v_payment.purchased_minutes,
      'ativo',
      v_payment.amount,
      'Ativacao via Pix: ' || v_payment.plan_name
    )
    returning * into v_subscription;
  end if;

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
    v_payment.customer_id,
    case when v_previous > 0 then 'renovacao' else 'credito' end,
    v_payment.purchased_minutes,
    v_previous,
    v_new,
    'Compra de plano via Pix',
    v_payment.plan_name || ' - pagamento ' || v_payment.id::text
  );

  update public.arena_plan_payments
    set
      status = 'approved',
      approved_at = coalesce(approved_at, now()),
      subscription_id = v_subscription.id,
      raw_response = coalesce(raw_response, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'activated_subscription_id',
        v_subscription.id,
        'balance_before_minutes',
        v_previous,
        'balance_after_minutes',
        v_new,
        'expiration_date',
        v_subscription.expiration_date
      )
    where id = v_payment.id
    returning * into v_payment;

  return next v_payment;
end;
$$;

create or replace function public.fail_arena_plan_payment(
  p_plan_payment_id uuid,
  p_status text default 'rejected',
  p_provider_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.arena_plan_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.arena_plan_payments;
  v_next_status text;
begin
  v_next_status := coalesce(nullif(trim(p_status), ''), 'rejected');
  if v_next_status not in ('rejected', 'cancelled', 'expired', 'refunded') then
    raise exception 'Status de falha invalido.';
  end if;

  select *
    into v_payment
    from public.arena_plan_payments
    where id = p_plan_payment_id
    for update;

  if not found then
    raise exception 'Pagamento de plano nao encontrado.';
  end if;

  if v_payment.status = 'approved' then
    raise exception 'Pagamento de plano aprovado nao pode ser marcado como falha.';
  end if;

  if v_payment.status in ('rejected', 'cancelled', 'expired', 'refunded') then
    return next v_payment;
    return;
  end if;

  update public.arena_plan_payments
    set
      status = v_next_status,
      failure_reason = case
        when failure_reason = '' then v_next_status
        else failure_reason
      end,
      raw_response = coalesce(raw_response, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
    where id = v_payment.id
    returning * into v_payment;

  insert into public.arena_plan_payment_events (
    plan_payment_id,
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
    'plan_payment.' || v_next_status,
    v_next_status,
    coalesce(p_metadata, '{}'::jsonb),
    true,
    now()
  )
  on conflict (provider, provider_event_id) where provider_event_id is not null and btrim(provider_event_id) <> '' do nothing;

  return next v_payment;
end;
$$;

create or replace function public.expire_arena_plan_payments()
returns table (expired_plan_payments integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  update public.arena_plan_payments
    set
      status = 'expired',
      failure_reason = case when failure_reason = '' then 'expired_automatically' else failure_reason end
    where status = 'pending'
      and expires_at is not null
      and expires_at <= now();

  get diagnostics v_count = row_count;
  expired_plan_payments := v_count;
  return next;
end;
$$;

create or replace function public.get_arena_plan_payment_status(p_plan_payment_id uuid)
returns table (
  id uuid,
  customer_name text,
  customer_phone text,
  plan_identifier text,
  plan_name text,
  amount numeric,
  purchased_hours numeric,
  purchased_minutes integer,
  validity_days integer,
  status text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  approved_at timestamptz,
  subscription_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.expire_arena_plan_payments();

  return query
  select
    payment.id,
    payment.customer_name,
    payment.customer_phone,
    payment.plan_identifier,
    payment.plan_name,
    payment.amount,
    payment.purchased_hours,
    payment.purchased_minutes,
    payment.validity_days,
    payment.status,
    payment.qr_code,
    payment.qr_code_base64,
    payment.ticket_url,
    payment.expires_at,
    payment.approved_at,
    payment.subscription_id
  from public.arena_plan_payments payment
  where payment.id = p_plan_payment_id
  limit 1;
end;
$$;

alter table public.arena_plan_payments enable row level security;
alter table public.arena_plan_payment_events enable row level security;

revoke all on table public.arena_plan_payments, public.arena_plan_payment_events from anon, authenticated;
grant select on table public.arena_plan_payments, public.arena_plan_payment_events to authenticated;
grant all privileges on table public.arena_plan_payments, public.arena_plan_payment_events to service_role;

drop policy if exists arena_plan_payments_admin_select on public.arena_plan_payments;
create policy arena_plan_payments_admin_select on public.arena_plan_payments for select to authenticated using (public.is_admin());
drop policy if exists arena_plan_payments_admin_update on public.arena_plan_payments;
create policy arena_plan_payments_admin_update on public.arena_plan_payments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists arena_plan_payments_admin_insert on public.arena_plan_payments;
create policy arena_plan_payments_admin_insert on public.arena_plan_payments for insert to authenticated with check (false);
drop policy if exists arena_plan_payments_admin_delete on public.arena_plan_payments;
create policy arena_plan_payments_admin_delete on public.arena_plan_payments for delete to authenticated using (false);

drop policy if exists arena_plan_payment_events_admin_select on public.arena_plan_payment_events;
create policy arena_plan_payment_events_admin_select on public.arena_plan_payment_events for select to authenticated using (public.is_admin());
drop policy if exists arena_plan_payment_events_admin_insert on public.arena_plan_payment_events;
create policy arena_plan_payment_events_admin_insert on public.arena_plan_payment_events for insert to authenticated with check (false);
drop policy if exists arena_plan_payment_events_admin_update on public.arena_plan_payment_events;
create policy arena_plan_payment_events_admin_update on public.arena_plan_payment_events for update to authenticated using (false);
drop policy if exists arena_plan_payment_events_admin_delete on public.arena_plan_payment_events;
create policy arena_plan_payment_events_admin_delete on public.arena_plan_payment_events for delete to authenticated using (false);

revoke execute on function public.create_arena_plan_payment(text, text, text, text) from anon, authenticated;
revoke execute on function public.confirm_arena_plan_payment(uuid, text, jsonb) from anon, authenticated;
revoke execute on function public.fail_arena_plan_payment(uuid, text, text, jsonb) from anon, authenticated;
revoke execute on function public.expire_arena_plan_payments() from anon, authenticated;
grant execute on function public.create_arena_plan_payment(text, text, text, text) to service_role;
grant execute on function public.confirm_arena_plan_payment(uuid, text, jsonb) to service_role;
grant execute on function public.fail_arena_plan_payment(uuid, text, text, jsonb) to service_role;
grant execute on function public.expire_arena_plan_payments() to service_role;
grant execute on function public.get_arena_plan_payment_status(uuid) to service_role;

commit;
