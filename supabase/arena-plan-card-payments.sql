begin;

alter table public.arena_plan_payments
  add column if not exists payment_method text,
  add column if not exists payment_type text,
  add column if not exists installments integer,
  add column if not exists payer_email text,
  add column if not exists payer_document text,
  add column if not exists card_brand text,
  add column if not exists card_last_four text,
  add column if not exists mercado_pago_transaction_id text,
  add column if not exists paid_at timestamptz;

alter table public.arena_plan_payments
  drop constraint if exists arena_plan_payments_payment_method_check;

alter table public.arena_plan_payments
  add constraint arena_plan_payments_payment_method_check
  check (
    payment_method is null
    or payment_method in ('pix', 'card', 'manual', 'unknown')
  );

alter table public.arena_plan_payments
  drop constraint if exists arena_plan_payments_payment_type_check;

alter table public.arena_plan_payments
  add constraint arena_plan_payments_payment_type_check
  check (
    payment_type is null
    or payment_type in ('bank_transfer', 'credit_card', 'manual', 'unknown')
  );

alter table public.arena_plan_payments
  drop constraint if exists arena_plan_payments_installments_check;

alter table public.arena_plan_payments
  add constraint arena_plan_payments_installments_check
  check (installments is null or installments > 0);

alter table public.arena_plan_payments
  drop constraint if exists arena_plan_payments_card_last_four_check;

alter table public.arena_plan_payments
  add constraint arena_plan_payments_card_last_four_check
  check (card_last_four is null or char_length(card_last_four) <= 4);

create index if not exists arena_plan_payments_payment_method_status_idx
  on public.arena_plan_payments(payment_method, status, created_at desc);

create index if not exists arena_plan_payments_mp_transaction_idx
  on public.arena_plan_payments(mercado_pago_transaction_id)
  where mercado_pago_transaction_id is not null and btrim(mercado_pago_transaction_id) <> '';

create or replace function public.create_arena_plan_card_payment(
  p_plan_identifier text,
  p_customer_name text,
  p_customer_phone text,
  p_payer_email text,
  p_payer_document text default null,
  p_installments integer default 1,
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
  v_email text;
  v_document text;
  v_installments integer;
  v_expires_at timestamptz;
begin
  perform public.expire_arena_plan_payments();

  v_phone := public.normalize_arena_phone(p_customer_phone);
  v_key := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_email := lower(nullif(trim(coalesce(p_payer_email, '')), ''));
  v_document := regexp_replace(coalesce(p_payer_document, ''), '\D', '', 'g');
  v_installments := greatest(1, coalesce(p_installments, 1));

  if nullif(trim(coalesce(p_plan_identifier, '')), '') is null then
    raise exception 'Plano obrigatorio.';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Nome obrigatorio.';
  end if;

  if nullif(v_phone, '') is null then
    raise exception 'WhatsApp obrigatorio.';
  end if;

  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail obrigatorio para pagamento com cartao.';
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
        and payment_method = 'card'
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
          'not_reusable_for_plan_card'
        )
      where payment.idempotency_key = v_key
        and not (
          payment.customer_phone_normalized = v_phone
          and payment.plan_id = v_plan.id
          and payment.status = 'pending'
          and payment.payment_method = 'card'
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
    payment_method,
    payment_type,
    installments,
    payer_email,
    payer_document,
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
    'card',
    'credit_card',
    v_installments,
    v_email,
    nullif(v_document, ''),
    jsonb_build_object(
      'source',
      'public_arena_plan_card',
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
  v_method_label text := 'Pix';
begin
  select *
    into v_payment
    from public.arena_plan_payments
    where id = p_plan_payment_id
    for update;

  if not found then
    raise exception 'Pagamento de plano nao encontrado.';
  end if;

  v_method_label := case
    when v_payment.payment_method = 'card' then 'cartao'
    when v_payment.payment_method = 'manual' then 'manual'
    else 'Pix'
  end;

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
        notes = trim(concat_ws(E'\n', nullif(notes, ''), 'Renovacao via ' || v_method_label || ': ' || v_payment.plan_name))
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
      'Ativacao via ' || v_method_label || ': ' || v_payment.plan_name
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
    'Compra de plano via ' || v_method_label,
    v_payment.plan_name || ' - pagamento ' || v_payment.id::text
  );

  update public.arena_plan_payments
    set
      status = 'approved',
      approved_at = coalesce(approved_at, now()),
      paid_at = coalesce(paid_at, now()),
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
        v_subscription.expiration_date,
        'payment_method_label',
        v_method_label
      )
    where id = v_payment.id
    returning * into v_payment;

  return next v_payment;
end;
$$;

drop function if exists public.get_arena_plan_payment_status(uuid);

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
  payment_method text,
  payment_type text,
  installments integer,
  card_brand text,
  card_last_four text,
  mercado_pago_order_id text,
  mercado_pago_payment_id text,
  mercado_pago_transaction_id text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  failure_reason text,
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
    payment.payment_method,
    payment.payment_type,
    payment.installments,
    payment.card_brand,
    payment.card_last_four,
    payment.mercado_pago_order_id,
    payment.mercado_pago_payment_id,
    payment.mercado_pago_transaction_id,
    payment.qr_code,
    payment.qr_code_base64,
    payment.ticket_url,
    payment.expires_at,
    payment.approved_at,
    payment.paid_at,
    payment.failure_reason,
    payment.subscription_id
  from public.arena_plan_payments payment
  where payment.id = p_plan_payment_id
  limit 1;
end;
$$;

revoke execute on function public.create_arena_plan_card_payment(text, text, text, text, text, integer, text) from anon, authenticated;
grant execute on function public.create_arena_plan_card_payment(text, text, text, text, text, integer, text) to service_role;

revoke execute on function public.get_arena_plan_payment_status(uuid) from anon, authenticated;
grant execute on function public.get_arena_plan_payment_status(uuid) to service_role;

commit;
