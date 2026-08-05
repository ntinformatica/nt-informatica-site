begin;

-- NT Store Commerce - Phase 1 RPC layer.
-- This file assumes supabase/store-commerce-phase-1.sql has already been applied.
-- Public checkout writes should be routed through Edge Functions using the service_role.

alter table public.store_orders
  add column if not exists checkout_idempotency_key text;

create unique index if not exists store_orders_checkout_idempotency_key_uidx
  on public.store_orders(checkout_idempotency_key)
  where checkout_idempotency_key is not null and btrim(checkout_idempotency_key) <> '';

create unique index if not exists store_payments_one_approved_per_order_uidx
  on public.store_payments(order_id)
  where status = 'approved';

create or replace function public.list_store_inventory_availability()
returns table (
  item_type text,
  product_id uuid,
  variation_id uuid,
  assembled_pc_id uuid,
  physical_stock integer,
  reserved_stock integer,
  available_stock integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    'product'::text as item_type,
    product.id as product_id,
    null::uuid as variation_id,
    null::uuid as assembled_pc_id,
    greatest(coalesce(product.stock, 0), 0)::integer as physical_stock,
    greatest(coalesce(reserved.quantity, 0), 0)::integer as reserved_stock,
    greatest(coalesce(product.stock, 0) - coalesce(reserved.quantity, 0), 0)::integer as available_stock
  from public.products product
  left join (
    select reservation.product_id, sum(reservation.quantity)::integer as quantity
    from public.store_stock_reservations reservation
    where reservation.status = 'active'
      and reservation.product_id is not null
      and reservation.expires_at > now()
    group by reservation.product_id
  ) reserved on reserved.product_id = product.id

  union all

  select
    'variation'::text as item_type,
    variation.product_id,
    variation.id as variation_id,
    null::uuid as assembled_pc_id,
    greatest(coalesce(variation.stock, 0), 0)::integer as physical_stock,
    greatest(coalesce(reserved.quantity, 0), 0)::integer as reserved_stock,
    greatest(coalesce(variation.stock, 0) - coalesce(reserved.quantity, 0), 0)::integer as available_stock
  from public.product_variations variation
  left join (
    select reservation.variation_id, sum(reservation.quantity)::integer as quantity
    from public.store_stock_reservations reservation
    where reservation.status = 'active'
      and reservation.variation_id is not null
      and reservation.expires_at > now()
    group by reservation.variation_id
  ) reserved on reserved.variation_id = variation.id

  union all

  select
    'assembled_pc'::text as item_type,
    null::uuid as product_id,
    null::uuid as variation_id,
    pc.id as assembled_pc_id,
    greatest(coalesce(pc.stock, 0), 0)::integer as physical_stock,
    greatest(coalesce(reserved.quantity, 0), 0)::integer as reserved_stock,
    greatest(coalesce(pc.stock, 0) - coalesce(reserved.quantity, 0), 0)::integer as available_stock
  from public.assembled_pcs pc
  left join (
    select reservation.assembled_pc_id, sum(reservation.quantity)::integer as quantity
    from public.store_stock_reservations reservation
    where reservation.status = 'active'
      and reservation.assembled_pc_id is not null
      and reservation.expires_at > now()
    group by reservation.assembled_pc_id
  ) reserved on reserved.assembled_pc_id = pc.id;
$$;

revoke all on function public.list_store_inventory_availability() from public;
grant execute on function public.list_store_inventory_availability() to anon, authenticated, service_role;

alter table public.stock_movements
  alter column product_id drop not null,
  add column if not exists assembled_pc_id uuid references public.assembled_pcs(id) on delete set null;

alter table public.stock_movements
  drop constraint if exists stock_movements_stock_source_check;

alter table public.stock_movements
  add constraint stock_movements_stock_source_check
  check (
    product_id is not null
    or variation_id is not null
    or assembled_pc_id is not null
  );

create index if not exists stock_movements_assembled_pc_id_idx
  on public.stock_movements(assembled_pc_id);

create unique index if not exists stock_movements_idempotency_key_uidx
  on public.stock_movements(idempotency_key)
  where idempotency_key is not null and btrim(idempotency_key) <> '';

create or replace function public.store_order_public_summary(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_id', store_order.id,
    'order_number', store_order.order_number,
    'checkout_token', store_order.checkout_token,
    'financial_status', store_order.financial_status,
    'operational_status', store_order.operational_status,
    'subtotal_amount', store_order.subtotal_amount,
    'discount_amount', store_order.discount_amount,
    'total_amount', store_order.total_amount,
    'payment_method', store_order.payment_method,
    'installments', store_order.installments,
    'installment_amount', store_order.installment_amount,
    'expires_at', store_order.expires_at,
    'items_count', (
      select count(*)::integer
      from public.store_order_items store_item
      where store_item.order_id = store_order.id
    ),
    'payment_id', store_payment.id,
    'payment_external_reference', store_payment.external_reference,
    'manual_review_required', store_order.manual_review_required,
    'manual_review_reason', store_order.manual_review_reason
  )
  from public.store_orders store_order
  left join lateral (
    select payment.id, payment.external_reference
    from public.store_payments payment
    where payment.order_id = store_order.id
    order by payment.attempt_number desc, payment.created_at desc
    limit 1
  ) store_payment on true
  where store_order.id = p_order_id;
$$;

revoke all on function public.store_order_public_summary(uuid) from public;
revoke all on function public.store_order_public_summary(uuid) from anon;
revoke all on function public.store_order_public_summary(uuid) from authenticated;
grant execute on function public.store_order_public_summary(uuid) to service_role;

create or replace function public.create_store_order_from_cart(
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text,
  p_installments integer default null,
  p_order_source text default 'site',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_expires_at timestamptz := v_now + interval '20 minutes';
  v_customer_name text;
  v_customer_phone text;
  v_customer_phone_normalized text;
  v_customer_email text;
  v_customer_document text;
  v_payment_method text := lower(btrim(coalesce(p_payment_method, '')));
  v_order_source text := lower(btrim(coalesce(p_order_source, 'site')));
  v_installments integer;
  v_installment_amount numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_order_id uuid;
  v_order_item_id uuid;
  v_payment_id uuid;
  v_item jsonb;
  v_item_index bigint;
  v_item_type text;
  v_quantity integer;
  v_product_id uuid;
  v_variation_id uuid;
  v_assembled_pc_id uuid;
  v_product record;
  v_variation record;
  v_pc record;
  v_stock_physical integer;
  v_stock_reserved integer;
  v_available_stock integer;
  v_unit_price numeric(12, 2);
  v_unit_promo_price numeric(12, 2);
  v_final_unit_price numeric(12, 2);
  v_line_subtotal numeric(12, 2);
  v_sku text;
  v_internal_code text;
  v_variation_name text;
  v_main_image text;
  v_config_snapshot jsonb;
  v_payment_type text;
  v_document_masked text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operacao permitida somente via service_role.';
  end if;

  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Dados do cliente invalidos.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'Chave de idempotencia obrigatoria.';
  end if;

  v_customer_name := nullif(btrim(coalesce(p_customer->>'customer_name', p_customer->>'name', '')), '');
  v_customer_phone := nullif(btrim(coalesce(p_customer->>'customer_phone', p_customer->>'phone', '')), '');
  v_customer_phone_normalized := nullif(
    btrim(coalesce(p_customer->>'customer_phone_normalized', p_customer->>'phone_normalized', '')),
    ''
  );
  v_customer_email := btrim(coalesce(p_customer->>'customer_email', p_customer->>'email', ''));
  v_customer_document := regexp_replace(coalesce(p_customer->>'customer_document', p_customer->>'document', ''), '\D', '', 'g');

  if v_customer_phone_normalized is null and v_customer_phone is not null then
    v_customer_phone_normalized := nullif(regexp_replace(v_customer_phone, '\D', '', 'g'), '');
  end if;

  if v_customer_name is null then
    raise exception 'Nome do cliente obrigatorio.';
  end if;

  if v_customer_phone is null or v_customer_phone_normalized is null then
    raise exception 'Telefone do cliente obrigatorio.';
  end if;

  if v_payment_method not in ('pix', 'card') then
    raise exception 'Forma de pagamento invalida.';
  end if;

  if v_order_source not in ('site', 'admin', 'whatsapp', 'marketplace', 'api') then
    raise exception 'Origem do pedido invalida.';
  end if;

  if v_payment_method = 'pix' then
    if p_installments is not null and p_installments <> 1 then
      raise exception 'Pix nao permite parcelamento.';
    end if;
    v_installments := 1;
    v_payment_type := 'bank_transfer';
  else
    v_installments := coalesce(p_installments, 1);
    v_payment_type := 'credit_card';

    if v_installments < 1 or v_installments > 10 then
      raise exception 'Cartao permite de 1 a 10 parcelas.';
    end if;

    if nullif(v_customer_document, '') is null then
      raise exception 'Documento do cliente obrigatorio para cartao.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('store_order:' || btrim(p_idempotency_key), 0));

  select existing_order.id
  into v_order_id
  from public.store_orders existing_order
  where existing_order.checkout_idempotency_key = btrim(p_idempotency_key)
  for update;

  if v_order_id is not null then
    return public.store_order_public_summary(v_order_id) || jsonb_build_object('idempotent', true);
  end if;

  insert into public.store_orders (
    checkout_idempotency_key,
    order_source,
    customer_name,
    customer_phone,
    customer_phone_normalized,
    customer_email,
    customer_document,
    financial_status,
    operational_status,
    subtotal_amount,
    discount_amount,
    total_amount,
    payment_method,
    installments,
    installment_amount,
    pickup_method,
    pickup_status,
    expires_at,
    metadata
  )
  values (
    btrim(p_idempotency_key),
    v_order_source,
    v_customer_name,
    v_customer_phone,
    v_customer_phone_normalized,
    v_customer_email,
    v_customer_document,
    'pending',
    'awaiting_payment',
    0,
    0,
    0,
    v_payment_method,
    v_installments,
    null,
    'store_pickup',
    'not_ready',
    v_expires_at,
    jsonb_build_object('checkout_version', 'store_phase_1')
  )
  returning id into v_order_id;

  for v_item, v_item_index in
    select item_value, item_index
    from jsonb_array_elements(p_items) with ordinality as cart_items(item_value, item_index)
  loop
    v_item_type := lower(btrim(coalesce(v_item->>'item_type', '')));
    v_quantity := case
      when coalesce(v_item->>'quantity', '') ~ '^[0-9]+$' then (v_item->>'quantity')::integer
      else 0
    end;

    if v_item_type not in ('product', 'assembled_pc') then
      raise exception 'Tipo de item nao permitido nesta fase.';
    end if;

    if v_quantity <= 0 then
      raise exception 'Quantidade invalida no item %.', v_item_index;
    end if;

    v_product_id := null;
    v_variation_id := null;
    v_assembled_pc_id := null;
    v_unit_price := null;
    v_unit_promo_price := null;
    v_final_unit_price := null;
    v_sku := '';
    v_internal_code := '';
    v_variation_name := '';
    v_main_image := '';
    v_config_snapshot := '{}'::jsonb;

    if v_item_type = 'product' then
      if nullif(v_item->>'product_id', '') is null then
        raise exception 'Produto obrigatorio no item %.', v_item_index;
      end if;

      v_product_id := (v_item->>'product_id')::uuid;
      v_variation_id := nullif(v_item->>'variation_id', '')::uuid;

      select *
      into v_product
      from public.products product
      where product.id = v_product_id
      for update;

      if not found then
        raise exception 'Produto nao encontrado.';
      end if;

      if lower(coalesce(v_product.status, '')) not in ('disponível', 'disponivel') then
        raise exception 'Produto indisponivel para venda.';
      end if;

      if v_variation_id is not null then
        select *
        into v_variation
        from public.product_variations variation
        where variation.id = v_variation_id
          and variation.product_id = v_product_id
        for update;

        if not found then
          raise exception 'Variacao nao pertence ao produto informado.';
        end if;

        if coalesce(v_variation.active, false) is false or lower(coalesce(v_variation.status, '')) <> 'ativo' then
          raise exception 'Variacao indisponivel para venda.';
        end if;

        v_stock_physical := coalesce(v_variation.stock, 0);
        select coalesce(sum(reservation.quantity), 0)::integer
        into v_stock_reserved
        from public.store_stock_reservations reservation
        where reservation.variation_id = v_variation_id
          and reservation.status = 'active'
          and reservation.expires_at > v_now;

        v_unit_price := coalesce(v_variation.price, v_product.price);
        v_unit_promo_price := coalesce(v_variation.promo_price, v_product.promo_price);
        v_sku := coalesce(nullif(btrim(v_variation.sku), ''), nullif(btrim(v_product.sku), ''), '');
        v_variation_name := btrim(concat_ws(' ', nullif(v_variation.name, ''), nullif(v_variation.value, ''), nullif(v_variation.color, '')));
        v_main_image := coalesce(v_variation.image, v_product.main_image, '');
        v_config_snapshot := jsonb_build_object(
          'product_id', v_product.id,
          'variation_id', v_variation.id,
          'variation_name', v_variation.name,
          'variation_value', v_variation.value,
          'variation_color', v_variation.color
        );
      else
        v_stock_physical := coalesce(v_product.stock, 0);
        select coalesce(sum(reservation.quantity), 0)::integer
        into v_stock_reserved
        from public.store_stock_reservations reservation
        where reservation.product_id = v_product_id
          and reservation.status = 'active'
          and reservation.expires_at > v_now;

        v_unit_price := v_product.price;
        v_unit_promo_price := v_product.promo_price;
        v_sku := coalesce(nullif(btrim(v_product.sku), ''), '');
        v_main_image := coalesce(v_product.main_image, '');
        v_config_snapshot := jsonb_build_object('product_id', v_product.id);
      end if;

      if nullif(v_sku, '') is null then
        raise exception 'Produto sem SKU valido.';
      end if;

      if v_unit_price is null or v_unit_price < 0 then
        raise exception 'Produto sem preco valido.';
      end if;

      v_final_unit_price := v_unit_price;

      v_available_stock := v_stock_physical - v_stock_reserved;

      if v_available_stock < v_quantity then
        raise exception 'Estoque insuficiente.';
      end if;

      v_line_subtotal := round(v_final_unit_price * v_quantity, 2);
      v_subtotal := round(v_subtotal + v_line_subtotal, 2);

      insert into public.store_order_items (
        order_id,
        item_type,
        product_id,
        variation_id,
        sku,
        slug,
        product_name,
        variation_name,
        brand,
        model,
        quantity,
        unit_price,
        unit_promo_price,
        final_unit_price,
        subtotal_amount,
        main_image,
        warranty,
        condition_label,
        configuration_snapshot
      )
      values (
        v_order_id,
        'product',
        v_product_id,
        v_variation_id,
        v_sku,
        coalesce(v_product.slug, ''),
        v_product.name,
        v_variation_name,
        coalesce(v_product.brand, ''),
        coalesce(v_product.model, ''),
        v_quantity,
        v_unit_price,
        v_unit_promo_price,
        v_final_unit_price,
        v_line_subtotal,
        v_main_image,
        coalesce(v_product.warranty, ''),
        coalesce(v_product.status, ''),
        v_config_snapshot
      )
      returning id into v_order_item_id;

      insert into public.store_stock_reservations (
        order_id,
        order_item_id,
        product_id,
        variation_id,
        quantity,
        status,
        expires_at,
        idempotency_key,
        metadata
      )
      values (
        v_order_id,
        v_order_item_id,
        case when v_variation_id is null then v_product_id else null end,
        v_variation_id,
        v_quantity,
        'active',
        v_expires_at,
        btrim(p_idempotency_key) || ':reservation:' || v_item_index::text,
        jsonb_build_object('item_type', 'product')
      );
    else
      if nullif(v_item->>'assembled_pc_id', '') is null then
        raise exception 'PC montado obrigatorio no item %.', v_item_index;
      end if;

      v_assembled_pc_id := (v_item->>'assembled_pc_id')::uuid;

      select *
      into v_pc
      from public.assembled_pcs pc
      where pc.id = v_assembled_pc_id
      for update;

      if not found then
        raise exception 'PC montado nao encontrado.';
      end if;

      if coalesce(v_pc.published, false) is false or lower(coalesce(v_pc.status, '')) in ('rascunho', 'desativado', 'esgotado') then
        raise exception 'PC montado indisponivel para venda.';
      end if;

      if nullif(btrim(coalesce(v_pc.internal_code, '')), '') is null then
        raise exception 'PC montado sem codigo interno.';
      end if;

      if v_pc.price is null or v_pc.price < 0 then
        raise exception 'PC montado sem preco valido.';
      end if;

      v_stock_physical := coalesce(v_pc.stock, 0);
      select coalesce(sum(reservation.quantity), 0)::integer
      into v_stock_reserved
      from public.store_stock_reservations reservation
      where reservation.assembled_pc_id = v_assembled_pc_id
        and reservation.status = 'active'
        and reservation.expires_at > v_now;

      v_available_stock := v_stock_physical - v_stock_reserved;

      if v_available_stock < v_quantity then
        raise exception 'Estoque insuficiente.';
      end if;

      v_unit_price := v_pc.price;
      v_unit_promo_price := v_pc.promo_price;
      v_final_unit_price := v_unit_price;
      v_line_subtotal := round(v_final_unit_price * v_quantity, 2);
      v_subtotal := round(v_subtotal + v_line_subtotal, 2);
      v_config_snapshot := jsonb_build_object(
        'processor', v_pc.processor,
        'motherboard', v_pc.motherboard,
        'memory', v_pc.memory,
        'storage', v_pc.storage,
        'graphics_card', v_pc.graphics_card,
        'power_supply', v_pc.power_supply,
        'case_model', v_pc.case_model,
        'cooling', v_pc.cooling,
        'operating_system', v_pc.operating_system,
        'pc_type', v_pc.pc_type,
        'processor_cooler', v_pc.processor_cooler,
        'hard_drive', v_pc.hard_drive,
        'fans', v_pc.fans,
        'wifi', v_pc.wifi,
        'bluetooth', v_pc.bluetooth,
        'rgb', v_pc.rgb,
        'office_included', v_pc.office_included,
        'windows_included', v_pc.windows_included,
        'windows_version', v_pc.windows_version,
        'warranty_months', v_pc.warranty_months,
        'target_uses', v_pc.target_uses,
        'quality_checks', v_pc.quality_checks
      );

      insert into public.store_order_items (
        order_id,
        item_type,
        assembled_pc_id,
        internal_code,
        slug,
        product_name,
        quantity,
        unit_price,
        unit_promo_price,
        final_unit_price,
        subtotal_amount,
        main_image,
        warranty,
        condition_label,
        configuration_snapshot
      )
      values (
        v_order_id,
        'assembled_pc',
        v_assembled_pc_id,
        v_pc.internal_code,
        coalesce(v_pc.slug, ''),
        v_pc.name,
        v_quantity,
        v_unit_price,
        v_unit_promo_price,
        v_final_unit_price,
        v_line_subtotal,
        coalesce(v_pc.main_image, ''),
        coalesce(v_pc.warranty, ''),
        coalesce(v_pc.status, ''),
        v_config_snapshot
      )
      returning id into v_order_item_id;

      insert into public.store_stock_reservations (
        order_id,
        order_item_id,
        assembled_pc_id,
        quantity,
        status,
        expires_at,
        idempotency_key,
        metadata
      )
      values (
        v_order_id,
        v_order_item_id,
        v_assembled_pc_id,
        v_quantity,
        'active',
        v_expires_at,
        btrim(p_idempotency_key) || ':reservation:' || v_item_index::text,
        jsonb_build_object('item_type', 'assembled_pc')
      );
    end if;
  end loop;

  if v_subtotal <= 0 then
    raise exception 'Subtotal invalido.';
  end if;

  if v_payment_method = 'pix' then
    v_discount := round(v_subtotal * 0.15, 2);
    v_total := round(v_subtotal - v_discount, 2);
    v_installment_amount := v_total;
  else
    v_discount := 0;
    v_total := v_subtotal;
    v_installment_amount := round(v_total / v_installments, 2);
  end if;

  update public.store_orders
  set
    subtotal_amount = v_subtotal,
    discount_amount = v_discount,
    total_amount = v_total,
    installments = v_installments,
    installment_amount = v_installment_amount
  where id = v_order_id;

  v_document_masked := case
    when nullif(v_customer_document, '') is null then ''
    when char_length(v_customer_document) <= 4 then repeat('*', char_length(v_customer_document))
    else repeat('*', char_length(v_customer_document) - 4) || right(v_customer_document, 4)
  end;

  insert into public.store_payments (
    order_id,
    attempt_number,
    provider,
    payment_method,
    payment_type,
    status,
    amount,
    currency,
    installments,
    installment_amount,
    idempotency_key,
    payer_email,
    payer_document_masked,
    expires_at,
    metadata
  )
  values (
    v_order_id,
    1,
    'mercado_pago',
    v_payment_method,
    v_payment_type,
    'pending',
    v_total,
    'BRL',
    v_installments,
    v_installment_amount,
    btrim(p_idempotency_key) || ':payment:1',
    v_customer_email,
    v_document_masked,
    v_expires_at,
    jsonb_build_object('created_by', 'create_store_order_from_cart')
  )
  returning id into v_payment_id;

  insert into public.store_order_logs (
    order_id,
    payment_id,
    event_type,
    previous_financial_status,
    new_financial_status,
    previous_operational_status,
    new_operational_status,
    message,
    actor_type,
    source,
    metadata
  )
  values (
    v_order_id,
    v_payment_id,
    'order_created',
    null,
    'pending',
    null,
    'awaiting_payment',
    'Pedido criado e estoque reservado por 20 minutos.',
    'customer',
    'checkout',
    jsonb_build_object('items_count', jsonb_array_length(p_items))
  );

  return public.store_order_public_summary(v_order_id) || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.create_store_order_from_cart(jsonb, jsonb, text, integer, text, text) from public;
revoke all on function public.create_store_order_from_cart(jsonb, jsonb, text, integer, text, text) from anon;
revoke all on function public.create_store_order_from_cart(jsonb, jsonb, text, integer, text, text) from authenticated;
grant execute on function public.create_store_order_from_cart(jsonb, jsonb, text, integer, text, text) to service_role;

create or replace function public.expire_store_orders(
  p_limit integer default 100,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_order record;
  v_reservations_expired integer := 0;
  v_total_reservations_expired integer := 0;
  v_payments_expired integer := 0;
  v_total_payments_expired integer := 0;
  v_orders_expired integer := 0;
  v_processed_orders jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operacao permitida somente via service_role.';
  end if;

  for v_order in
    select store_order.*
    from public.store_orders store_order
    where store_order.financial_status in ('pending', 'processing')
      and store_order.expires_at is not null
      and store_order.expires_at <= p_now
      and store_order.operational_status <> 'manual_review'
      and not exists (
        select 1
        from public.store_payments payment
        where payment.order_id = store_order.id
          and payment.status = 'approved'
      )
      and exists (
        select 1
        from public.store_stock_reservations reservation
        where reservation.order_id = store_order.id
          and reservation.status = 'active'
          and reservation.expires_at <= p_now
      )
    order by store_order.expires_at asc
    limit v_limit
    for update skip locked
  loop
    update public.store_stock_reservations reservation
    set
      status = 'expired',
      released_at = p_now,
      release_reason = 'order_expired'
    where reservation.order_id = v_order.id
      and reservation.status = 'active'
      and reservation.expires_at <= p_now;

    get diagnostics v_reservations_expired = row_count;

    if v_reservations_expired > 0 then
      update public.store_payments payment
      set
        status = 'expired',
        status_detail = case
          when coalesce(payment.status_detail, '') = '' then 'order_expired'
          else payment.status_detail
        end,
        metadata = payment.metadata || jsonb_build_object('expired_by', 'expire_store_orders')
      where payment.order_id = v_order.id
        and payment.status in ('created', 'pending', 'processing')
        and payment.status <> 'approved'
        and (
          payment.expires_at is null
          or payment.expires_at <= p_now
          or v_order.expires_at <= p_now
        );

      get diagnostics v_payments_expired = row_count;

      update public.store_orders
      set
        financial_status = 'expired',
        operational_status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, p_now),
        metadata = metadata || jsonb_build_object('expired_by', 'expire_store_orders')
      where id = v_order.id;

      insert into public.store_order_logs (
        order_id,
        event_type,
        previous_financial_status,
        new_financial_status,
        previous_operational_status,
        new_operational_status,
        message,
        actor_type,
        source,
        metadata
      )
      values (
        v_order.id,
        'order_expired',
        v_order.financial_status,
        'expired',
        v_order.operational_status,
        'cancelled',
        'Pedido expirado e reservas vencidas liberadas.',
        'system',
        'expiration_job',
        jsonb_build_object(
          'reservations_expired', v_reservations_expired,
          'payments_expired', v_payments_expired
        )
      );

      v_orders_expired := v_orders_expired + 1;
      v_total_reservations_expired := v_total_reservations_expired + v_reservations_expired;
      v_total_payments_expired := v_total_payments_expired + v_payments_expired;
      v_processed_orders := v_processed_orders || jsonb_build_array(
        jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number)
      );
    end if;
  end loop;

  return jsonb_build_object(
    'orders_expired', v_orders_expired,
    'payments_expired', v_total_payments_expired,
    'reservations_expired', v_total_reservations_expired,
    'processed_orders', v_processed_orders
  );
end;
$$;

revoke all on function public.expire_store_orders(integer, timestamptz) from public;
revoke all on function public.expire_store_orders(integer, timestamptz) from anon;
revoke all on function public.expire_store_orders(integer, timestamptz) from authenticated;
grant execute on function public.expire_store_orders(integer, timestamptz) to service_role;

create or replace function public.confirm_store_payment(
  p_payment_id uuid default null,
  p_external_reference text default null,
  p_mercado_pago_payment_id text default '',
  p_status text default 'approved',
  p_status_detail text default '',
  p_provider_event_id text default null,
  p_raw_response jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_payment record;
  v_order record;
  v_reservation record;
  v_product record;
  v_variation record;
  v_pc record;
  v_stock_problem boolean := false;
  v_late_approval boolean := false;
  v_previous_financial_status text;
  v_previous_operational_status text;
  v_event_payload jsonb;
  v_existing_event_id uuid;
  v_active_reservations integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operacao permitida somente via service_role.';
  end if;

  if v_status not in ('approved', 'rejected', 'cancelled', 'expired') then
    raise exception 'Status de pagamento invalido.';
  end if;

  if p_payment_id is null and nullif(btrim(coalesce(p_external_reference, '')), '') is null then
    raise exception 'Informe payment_id ou external_reference.';
  end if;

  if nullif(btrim(coalesce(p_provider_event_id, '')), '') is not null then
    select event.id
    into v_existing_event_id
    from public.store_payment_events event
    where event.provider = 'mercado_pago'
      and event.provider_event_id = btrim(p_provider_event_id)
    limit 1;

    if v_existing_event_id is not null then
      return jsonb_build_object('processed', true, 'idempotent', true, 'event_id', v_existing_event_id);
    end if;
  end if;

  select *
  into v_payment
  from public.store_payments payment
  where (
      p_payment_id is not null
      and payment.id = p_payment_id
    )
    or (
      p_payment_id is null
      and payment.external_reference = btrim(p_external_reference)
    )
  for update;

  if not found then
    raise exception 'Pagamento interno nao encontrado.';
  end if;

  select *
  into v_order
  from public.store_orders store_order
  where store_order.id = v_payment.order_id
  for update;

  if not found then
    raise exception 'Pedido do pagamento nao encontrado.';
  end if;

  if exists (
    select 1
    from public.store_payments approved_payment
    where approved_payment.order_id = v_order.id
      and approved_payment.status = 'approved'
      and approved_payment.id <> v_payment.id
  ) then
    update public.store_orders
    set
      operational_status = 'manual_review',
      manual_review_required = true,
      manual_review_reason = 'Outro pagamento ja foi aprovado para este pedido.'
    where id = v_order.id;

    insert into public.store_order_logs (
      order_id,
      payment_id,
      event_type,
      previous_financial_status,
      new_financial_status,
      previous_operational_status,
      new_operational_status,
      message,
      actor_type,
      source
    )
    values (
      v_order.id,
      v_payment.id,
      'manual_review_required',
      v_order.financial_status,
      v_order.financial_status,
      v_order.operational_status,
      'manual_review',
      'Tentativa de confirmar um segundo pagamento aprovado para o mesmo pedido.',
      'mercado_pago',
      'payment_function'
    );

    return public.store_order_public_summary(v_order.id) || jsonb_build_object('manual_review', true, 'reason', 'order_already_has_approved_payment');
  end if;

  v_event_payload := coalesce(p_raw_response, '{}'::jsonb)
    - 'token'
    - 'access_token'
    - 'authorization'
    - 'card'
    #- '{payer,identification}'
    #- '{additional_info,payer,identification}';

  if v_status <> 'approved' then
    update public.store_payments
    set
      status = v_status,
      status_detail = coalesce(p_status_detail, ''),
      mercado_pago_payment_id = coalesce(nullif(btrim(p_mercado_pago_payment_id), ''), mercado_pago_payment_id),
      raw_response = v_event_payload
    where id = v_payment.id;

    insert into public.store_payment_events (
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
      'mercado_pago',
      nullif(btrim(coalesce(p_provider_event_id, '')), ''),
      'payment_' || v_status,
      v_status,
      v_event_payload || jsonb_build_object('idempotency_key', coalesce(p_idempotency_key, '')),
      true,
      v_now
    )
    on conflict (provider, provider_event_id)
    where provider_event_id is not null and btrim(provider_event_id) <> ''
    do nothing;

    insert into public.store_order_logs (
      order_id,
      payment_id,
      event_type,
      previous_financial_status,
      new_financial_status,
      previous_operational_status,
      new_operational_status,
      message,
      actor_type,
      source
    )
    values (
      v_order.id,
      v_payment.id,
      'payment_' || v_status,
      v_order.financial_status,
      v_order.financial_status,
      v_order.operational_status,
      v_order.operational_status,
      'Pagamento recebeu status nao aprovado.',
      'mercado_pago',
      'payment_function'
    );

    return public.store_order_public_summary(v_order.id) || jsonb_build_object('payment_status', v_status);
  end if;

  if v_payment.status = 'approved' and v_order.financial_status = 'approved' then
    insert into public.store_payment_events (
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
      'mercado_pago',
      nullif(btrim(coalesce(p_provider_event_id, '')), ''),
      'payment_already_processed',
      'approved',
      v_event_payload,
      true,
      v_now
    )
    on conflict (provider, provider_event_id)
    where provider_event_id is not null and btrim(provider_event_id) <> ''
    do nothing;

    return public.store_order_public_summary(v_order.id) || jsonb_build_object('idempotent', true);
  end if;

  if v_payment.amount <> v_order.total_amount then
    update public.store_payments
    set
      status = 'approved',
      status_detail = coalesce(p_status_detail, ''),
      mercado_pago_payment_id = coalesce(nullif(btrim(p_mercado_pago_payment_id), ''), mercado_pago_payment_id),
      raw_response = v_event_payload,
      approved_at = coalesce(approved_at, v_now),
      paid_at = coalesce(paid_at, v_now)
    where id = v_payment.id;

    update public.store_orders
    set
      financial_status = 'approved',
      operational_status = 'manual_review',
      manual_review_required = true,
      manual_review_reason = 'Valor do pagamento difere do total do pedido.',
      paid_at = coalesce(paid_at, v_now)
    where id = v_order.id;

    insert into public.store_payment_events (
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
      'mercado_pago',
      nullif(btrim(coalesce(p_provider_event_id, '')), ''),
      'manual_review_required',
      'approved',
      v_event_payload,
      true,
      v_now
    )
    on conflict (provider, provider_event_id)
    where provider_event_id is not null and btrim(provider_event_id) <> ''
    do nothing;

    insert into public.store_order_logs (
      order_id,
      payment_id,
      event_type,
      previous_financial_status,
      new_financial_status,
      previous_operational_status,
      new_operational_status,
      message,
      actor_type,
      source
    )
    values (
      v_order.id,
      v_payment.id,
      'manual_review_required',
      v_order.financial_status,
      'approved',
      v_order.operational_status,
      'manual_review',
      'Pagamento aprovado com valor divergente; pedido enviado para revisao manual.',
      'mercado_pago',
      'payment_function'
    );

    return public.store_order_public_summary(v_order.id) || jsonb_build_object('manual_review', true, 'reason', 'payment_amount_mismatch');
  end if;

  select count(*)::integer
  into v_active_reservations
  from public.store_stock_reservations reservation
  where reservation.order_id = v_order.id
    and reservation.status = 'active'
    and reservation.expires_at > v_now;

  v_late_approval := v_order.financial_status not in ('pending', 'processing')
    or v_order.expires_at is null
    or v_order.expires_at <= v_now
    or v_active_reservations = 0;

  if not v_late_approval then
    for v_reservation in
      select *
      from public.store_stock_reservations reservation
      where reservation.order_id = v_order.id
        and reservation.status = 'active'
      for update
    loop
      if v_reservation.expires_at <= v_now then
        v_late_approval := true;
      elsif v_reservation.variation_id is not null then
        select *
        into v_variation
        from public.product_variations variation
        where variation.id = v_reservation.variation_id
        for update;

        if not found or coalesce(v_variation.stock, 0) < v_reservation.quantity then
          v_stock_problem := true;
        end if;
      elsif v_reservation.product_id is not null then
        select *
        into v_product
        from public.products product
        where product.id = v_reservation.product_id
        for update;

        if not found or coalesce(v_product.stock, 0) < v_reservation.quantity then
          v_stock_problem := true;
        end if;
      elsif v_reservation.assembled_pc_id is not null then
        select *
        into v_pc
        from public.assembled_pcs pc
        where pc.id = v_reservation.assembled_pc_id
        for update;

        if not found or coalesce(v_pc.stock, 0) < v_reservation.quantity then
          v_stock_problem := true;
        end if;
      end if;
    end loop;
  end if;

  v_previous_financial_status := v_order.financial_status;
  v_previous_operational_status := v_order.operational_status;

  update public.store_payments
  set
    status = 'approved',
    status_detail = coalesce(p_status_detail, ''),
    mercado_pago_payment_id = coalesce(nullif(btrim(p_mercado_pago_payment_id), ''), mercado_pago_payment_id),
    raw_response = v_event_payload,
    approved_at = coalesce(approved_at, v_now),
    paid_at = coalesce(paid_at, v_now)
  where id = v_payment.id;

  if v_late_approval or v_stock_problem then
    update public.store_orders
    set
      financial_status = 'approved',
      operational_status = 'manual_review',
      manual_review_required = true,
      manual_review_reason = case
        when v_stock_problem then 'Pagamento aprovado, mas o estoque fisico ficou insuficiente.'
        else 'Pagamento aprovado apos expiracao da reserva.'
      end,
      paid_at = coalesce(paid_at, v_now)
    where id = v_order.id;

    insert into public.store_payment_events (
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
      'mercado_pago',
      nullif(btrim(coalesce(p_provider_event_id, '')), ''),
      'late_payment_approved',
      'approved',
      v_event_payload,
      true,
      v_now
    )
    on conflict (provider, provider_event_id)
    where provider_event_id is not null and btrim(provider_event_id) <> ''
    do nothing;

    insert into public.store_order_logs (
      order_id,
      payment_id,
      event_type,
      previous_financial_status,
      new_financial_status,
      previous_operational_status,
      new_operational_status,
      message,
      actor_type,
      source
    )
    values (
      v_order.id,
      v_payment.id,
      case when v_stock_problem then 'manual_review_required' else 'late_payment_approved' end,
      v_previous_financial_status,
      'approved',
      v_previous_operational_status,
      'manual_review',
      case
        when v_stock_problem then 'Pagamento aprovado, mas o estoque precisa de revisao manual.'
        else 'Pagamento aprovado apos expiracao; pedido enviado para revisao manual.'
      end,
      'mercado_pago',
      'payment_function'
    );

    return public.store_order_public_summary(v_order.id) || jsonb_build_object('manual_review', true);
  end if;

  for v_reservation in
    select *
    from public.store_stock_reservations reservation
    where reservation.order_id = v_order.id
      and reservation.status = 'active'
    order by reservation.created_at asc
    for update
  loop
    if v_reservation.variation_id is not null then
      select *
      into v_variation
      from public.product_variations variation
      where variation.id = v_reservation.variation_id
      for update;

      update public.product_variations
      set stock = stock - v_reservation.quantity
      where id = v_reservation.variation_id;

      insert into public.stock_movements (
        product_id,
        variation_id,
        type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        notes,
        order_id,
        order_item_id,
        reservation_id,
        movement_source,
        idempotency_key,
        metadata
      )
      values (
        v_variation.product_id,
        v_reservation.variation_id,
        'saida',
        v_reservation.quantity,
        v_variation.stock,
        v_variation.stock - v_reservation.quantity,
        'Venda e-commerce',
        'Baixa automatica apos pagamento aprovado.',
        v_order.id,
        v_reservation.order_item_id,
        v_reservation.id,
        'payment_function',
        'store-payment:' || v_payment.id::text || ':reservation:' || v_reservation.id::text,
        jsonb_build_object('payment_id', v_payment.id)
      )
      on conflict (idempotency_key)
      where idempotency_key is not null and btrim(idempotency_key) <> ''
      do nothing;
    elsif v_reservation.product_id is not null then
      select *
      into v_product
      from public.products product
      where product.id = v_reservation.product_id
      for update;

      update public.products
      set stock = stock - v_reservation.quantity
      where id = v_reservation.product_id;

      insert into public.stock_movements (
        product_id,
        type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        notes,
        order_id,
        order_item_id,
        reservation_id,
        movement_source,
        idempotency_key,
        metadata
      )
      values (
        v_reservation.product_id,
        'saida',
        v_reservation.quantity,
        v_product.stock,
        v_product.stock - v_reservation.quantity,
        'Venda e-commerce',
        'Baixa automatica apos pagamento aprovado.',
        v_order.id,
        v_reservation.order_item_id,
        v_reservation.id,
        'payment_function',
        'store-payment:' || v_payment.id::text || ':reservation:' || v_reservation.id::text,
        jsonb_build_object('payment_id', v_payment.id)
      )
      on conflict (idempotency_key)
      where idempotency_key is not null and btrim(idempotency_key) <> ''
      do nothing;
    elsif v_reservation.assembled_pc_id is not null then
      select *
      into v_pc
      from public.assembled_pcs pc
      where pc.id = v_reservation.assembled_pc_id
      for update;

      update public.assembled_pcs
      set stock = stock - v_reservation.quantity
      where id = v_reservation.assembled_pc_id;

      insert into public.stock_movements (
        assembled_pc_id,
        type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        notes,
        order_id,
        order_item_id,
        reservation_id,
        movement_source,
        idempotency_key,
        metadata
      )
      values (
        v_reservation.assembled_pc_id,
        'saida',
        v_reservation.quantity,
        v_pc.stock,
        v_pc.stock - v_reservation.quantity,
        'Venda e-commerce',
        'Baixa automatica apos pagamento aprovado.',
        v_order.id,
        v_reservation.order_item_id,
        v_reservation.id,
        'payment_function',
        'store-payment:' || v_payment.id::text || ':reservation:' || v_reservation.id::text,
        jsonb_build_object('payment_id', v_payment.id)
      )
      on conflict (idempotency_key)
      where idempotency_key is not null and btrim(idempotency_key) <> ''
      do nothing;
    end if;

    update public.store_stock_reservations
    set
      status = 'committed',
      committed_at = v_now
    where id = v_reservation.id;
  end loop;

  update public.store_orders
  set
    financial_status = 'approved',
    operational_status = 'paid',
    paid_at = coalesce(paid_at, v_now)
  where id = v_order.id;

  insert into public.store_payment_events (
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
    'mercado_pago',
    nullif(btrim(coalesce(p_provider_event_id, '')), ''),
    'payment_approved',
    'approved',
    v_event_payload,
    true,
    v_now
  )
  on conflict (provider, provider_event_id)
  where provider_event_id is not null and btrim(provider_event_id) <> ''
  do nothing;

  insert into public.store_order_logs (
    order_id,
    payment_id,
    event_type,
    previous_financial_status,
    new_financial_status,
    previous_operational_status,
    new_operational_status,
    message,
    actor_type,
    source
  )
  values (
    v_order.id,
    v_payment.id,
    'payment_approved',
    v_previous_financial_status,
    'approved',
    v_previous_operational_status,
    'paid',
    'Pagamento aprovado e estoque baixado definitivamente.',
    'mercado_pago',
    'payment_function'
  );

  insert into public.store_order_logs (
    order_id,
    payment_id,
    event_type,
    previous_financial_status,
    new_financial_status,
    previous_operational_status,
    new_operational_status,
    message,
    actor_type,
    source
  )
  values (
    v_order.id,
    v_payment.id,
    'stock_committed',
    'approved',
    'approved',
    'paid',
    'paid',
    'Reservas convertidas em movimentacoes de estoque.',
    'system',
    'stock_function'
  );

  return public.store_order_public_summary(v_order.id) || jsonb_build_object('manual_review', false);
end;
$$;

revoke all on function public.confirm_store_payment(uuid, text, text, text, text, text, jsonb, text) from public;
revoke all on function public.confirm_store_payment(uuid, text, text, text, text, text, jsonb, text) from anon;
revoke all on function public.confirm_store_payment(uuid, text, text, text, text, text, jsonb, text) from authenticated;
grant execute on function public.confirm_store_payment(uuid, text, text, text, text, text, jsonb, text) to service_role;

commit;
