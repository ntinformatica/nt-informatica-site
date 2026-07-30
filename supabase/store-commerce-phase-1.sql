begin;

create extension if not exists pgcrypto;

create sequence if not exists public.store_order_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;

create or replace function public.generate_store_order_number()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year text := to_char(current_date, 'YYYY');
  v_number bigint;
  v_order_number text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.is_admin(), false) then
    raise exception 'Apenas administradores podem gerar numero de pedido diretamente.';
  end if;

  loop
    v_number := nextval('public.store_order_number_seq');
    v_order_number := 'NT-' || v_year || '-' || lpad(v_number::text, 6, '0');

    if not exists (
      select 1
      from public.store_orders existing_order
      where existing_order.order_number = v_order_number
    ) then
      return v_order_number;
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_store_order_number() from public;
revoke all on function public.generate_store_order_number() from anon;
revoke all on function public.generate_store_order_number() from authenticated;
grant execute on function public.generate_store_order_number() to authenticated, service_role;

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_store_order_number(),
  checkout_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  order_source text not null default 'site',
  customer_name text not null,
  customer_phone text not null,
  customer_phone_normalized text not null,
  customer_email text not null default '',
  customer_document text not null default '',
  financial_status text not null default 'pending',
  operational_status text not null default 'awaiting_payment',
  subtotal_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  currency text not null default 'BRL',
  payment_method text not null default '',
  installments integer,
  installment_amount numeric(12, 2),
  pickup_method text not null default 'store_pickup',
  pickup_status text not null default 'not_ready',
  pickup_ready_at timestamptz,
  picked_up_at timestamptz,
  picked_up_by text not null default '',
  pickup_notes text not null default '',
  manual_review_required boolean not null default false,
  manual_review_reason text not null default '',
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_orders_financial_status_check check (
    financial_status in ('pending', 'processing', 'approved', 'rejected', 'cancelled', 'expired', 'refunded', 'charged_back')
  ),
  constraint store_orders_operational_status_check check (
    operational_status in ('awaiting_payment', 'paid', 'separating', 'ready_for_pickup', 'delivered', 'cancelled', 'manual_review')
  ),
  constraint store_orders_order_source_check check (order_source in ('site', 'admin', 'whatsapp', 'marketplace', 'api')),
  constraint store_orders_payment_method_check check (payment_method in ('', 'pix', 'card')),
  constraint store_orders_pickup_method_check check (pickup_method in ('store_pickup')),
  constraint store_orders_pickup_status_check check (pickup_status in ('not_ready', 'ready', 'picked_up', 'cancelled')),
  constraint store_orders_amounts_check check (
    subtotal_amount >= 0
    and discount_amount >= 0
    and total_amount >= 0
    and discount_amount <= subtotal_amount
  ),
  constraint store_orders_installments_check check (installments is null or (installments between 1 and 10)),
  constraint store_orders_installment_amount_check check (installment_amount is null or installment_amount >= 0),
  constraint store_orders_currency_check check (currency = 'BRL')
);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  item_type text not null default 'product',
  product_id uuid references public.products(id) on delete set null,
  variation_id uuid references public.product_variations(id) on delete set null,
  assembled_pc_id uuid references public.assembled_pcs(id) on delete set null,
  sku text not null default '',
  internal_code text not null default '',
  slug text not null default '',
  product_name text not null,
  variation_name text not null default '',
  brand text not null default '',
  model text not null default '',
  quantity integer not null,
  unit_price numeric(12, 2) not null default 0,
  unit_promo_price numeric(12, 2),
  final_unit_price numeric(12, 2) not null default 0,
  subtotal_amount numeric(12, 2) not null default 0,
  main_image text not null default '',
  warranty text not null default '',
  condition_label text not null default '',
  snapshot_version integer not null default 1,
  configuration_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint store_order_items_item_type_check check (item_type in ('product', 'assembled_pc', 'custom_pc')),
  constraint store_order_items_quantity_check check (quantity > 0),
  constraint store_order_items_money_check check (
    unit_price >= 0
    and (unit_promo_price is null or unit_promo_price >= 0)
    and final_unit_price >= 0
    and subtotal_amount >= 0
  ),
  constraint store_order_items_snapshot_version_check check (snapshot_version > 0),
  constraint store_order_items_identifier_check check (
    item_type = 'custom_pc'
    or nullif(btrim(sku), '') is not null
    or nullif(btrim(internal_code), '') is not null
  ),
  constraint store_order_items_reference_check check (
    (
      item_type = 'product'
      and product_id is not null
      and assembled_pc_id is null
    )
    or (
      item_type = 'assembled_pc'
      and product_id is null
      and variation_id is null
      and assembled_pc_id is not null
    )
    or (
      item_type = 'custom_pc'
      and product_id is null
      and variation_id is null
      and assembled_pc_id is null
    )
  )
);

create table if not exists public.store_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  attempt_number integer not null,
  provider text not null default 'mercado_pago',
  payment_method text not null,
  payment_type text not null default '',
  status text not null default 'pending',
  status_detail text not null default '',
  amount numeric(12, 2) not null default 0,
  currency text not null default 'BRL',
  installments integer,
  installment_amount numeric(12, 2),
  mercado_pago_order_id text,
  mercado_pago_payment_id text,
  mercado_pago_transaction_id text,
  external_reference text not null unique default gen_random_uuid()::text,
  idempotency_key text not null unique,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  payer_email text not null default '',
  payer_document_masked text not null default '',
  card_brand text not null default '',
  card_last_four text not null default '',
  raw_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_payments_attempt_number_check check (attempt_number between 1 and 5),
  constraint store_payments_provider_check check (provider in ('mercado_pago', 'manual', 'unknown')),
  constraint store_payments_method_check check (payment_method in ('pix', 'card')),
  constraint store_payments_type_check check (payment_type in ('', 'bank_transfer', 'credit_card')),
  constraint store_payments_status_check check (
    status in ('pending', 'processing', 'approved', 'rejected', 'cancelled', 'expired', 'refunded', 'charged_back')
  ),
  constraint store_payments_amount_check check (amount >= 0),
  constraint store_payments_installments_check check (installments is null or (installments between 1 and 10)),
  constraint store_payments_installment_amount_check check (installment_amount is null or installment_amount >= 0),
  constraint store_payments_card_last_four_check check (card_last_four = '' or char_length(card_last_four) <= 4),
  constraint store_payments_currency_check check (currency = 'BRL'),
  constraint store_payments_order_attempt_uidx unique (order_id, attempt_number)
);

create table if not exists public.store_payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.store_payments(id) on delete restrict,
  provider text not null default 'mercado_pago',
  provider_event_id text,
  event_type text not null,
  event_status text not null default '',
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text not null default '',
  created_at timestamptz not null default now(),
  constraint store_payment_events_provider_check check (provider in ('mercado_pago', 'internal', 'unknown'))
);

create unique index if not exists store_payment_events_provider_event_uidx
  on public.store_payment_events(provider, provider_event_id)
  where provider_event_id is not null and btrim(provider_event_id) <> '';

create table if not exists public.store_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  order_item_id uuid references public.store_order_items(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  variation_id uuid references public.product_variations(id) on delete restrict,
  assembled_pc_id uuid references public.assembled_pcs(id) on delete restrict,
  quantity integer not null,
  status text not null default 'active',
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  committed_at timestamptz,
  released_at timestamptz,
  release_reason text not null default '',
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint store_stock_reservations_quantity_check check (quantity > 0),
  constraint store_stock_reservations_status_check check (status in ('active', 'committed', 'released', 'expired')),
  constraint store_stock_reservations_reference_check check (
    num_nonnulls(product_id, variation_id, assembled_pc_id) = 1
  )
);

create table if not exists public.store_order_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete restrict,
  payment_id uuid references public.store_payments(id) on delete restrict,
  event_type text not null,
  previous_financial_status text,
  new_financial_status text,
  previous_operational_status text,
  new_operational_status text,
  message text not null default '',
  actor_type text not null default 'system',
  actor_id uuid,
  source text not null default 'checkout',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint store_order_logs_actor_type_check check (actor_type in ('customer', 'admin', 'webhook', 'system', 'mercado_pago')),
  constraint store_order_logs_source_check check (source in ('checkout', 'admin', 'webhook', 'expiration_job', 'payment_function', 'stock_function'))
);

alter table public.stock_movements
  add column if not exists order_id uuid references public.store_orders(id) on delete set null,
  add column if not exists order_item_id uuid references public.store_order_items(id) on delete set null,
  add column if not exists reservation_id uuid references public.store_stock_reservations(id) on delete set null,
  add column if not exists movement_source text not null default 'admin',
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.stock_movements
  drop constraint if exists stock_movements_movement_source_check;

alter table public.stock_movements
  add constraint stock_movements_movement_source_check
  check (movement_source in ('admin', 'checkout', 'payment_function', 'stock_function', 'expiration_job', 'manual'));

create unique index if not exists stock_movements_idempotency_key_uidx
  on public.stock_movements(idempotency_key)
  where idempotency_key is not null and btrim(idempotency_key) <> '';

drop trigger if exists store_orders_set_updated_at on public.store_orders;
create trigger store_orders_set_updated_at
before update on public.store_orders
for each row execute function public.set_updated_at();

drop trigger if exists store_payments_set_updated_at on public.store_payments;
create trigger store_payments_set_updated_at
before update on public.store_payments
for each row execute function public.set_updated_at();

create index if not exists store_orders_financial_status_idx on public.store_orders(financial_status);
create index if not exists store_orders_operational_status_idx on public.store_orders(operational_status);
create index if not exists store_orders_created_at_idx on public.store_orders(created_at desc);
create index if not exists store_orders_customer_phone_idx on public.store_orders(customer_phone_normalized);
create index if not exists store_orders_expires_at_idx on public.store_orders(expires_at)
  where financial_status in ('pending', 'processing');

create index if not exists store_order_items_order_id_idx on public.store_order_items(order_id);
create index if not exists store_order_items_product_id_idx on public.store_order_items(product_id);
create index if not exists store_order_items_variation_id_idx on public.store_order_items(variation_id);
create index if not exists store_order_items_assembled_pc_id_idx on public.store_order_items(assembled_pc_id);

create index if not exists store_payments_order_id_idx on public.store_payments(order_id);
create index if not exists store_payments_status_idx on public.store_payments(status);
create index if not exists store_payments_mp_order_idx on public.store_payments(mercado_pago_order_id)
  where mercado_pago_order_id is not null and btrim(mercado_pago_order_id) <> '';
create index if not exists store_payments_mp_payment_idx on public.store_payments(mercado_pago_payment_id)
  where mercado_pago_payment_id is not null and btrim(mercado_pago_payment_id) <> '';
create index if not exists store_payments_expires_at_idx on public.store_payments(expires_at)
  where status in ('pending', 'processing');

create index if not exists store_payment_events_payment_id_idx on public.store_payment_events(payment_id);
create index if not exists store_payment_events_created_at_idx on public.store_payment_events(created_at desc);

create index if not exists store_stock_reservations_order_id_idx on public.store_stock_reservations(order_id);
create index if not exists store_stock_reservations_order_item_id_idx on public.store_stock_reservations(order_item_id);
create index if not exists store_stock_reservations_product_active_idx
  on public.store_stock_reservations(product_id, status, expires_at)
  where status = 'active' and product_id is not null;
create index if not exists store_stock_reservations_variation_active_idx
  on public.store_stock_reservations(variation_id, status, expires_at)
  where status = 'active' and variation_id is not null;
create index if not exists store_stock_reservations_assembled_pc_active_idx
  on public.store_stock_reservations(assembled_pc_id, status, expires_at)
  where status = 'active' and assembled_pc_id is not null;
create index if not exists store_stock_reservations_expires_at_idx
  on public.store_stock_reservations(expires_at)
  where status = 'active';

create index if not exists store_order_logs_order_created_idx
  on public.store_order_logs(order_id, created_at desc);
create index if not exists store_order_logs_payment_id_idx on public.store_order_logs(payment_id);
create index if not exists store_order_logs_event_type_idx on public.store_order_logs(event_type);

create index if not exists stock_movements_order_id_idx on public.stock_movements(order_id);
create index if not exists stock_movements_order_item_id_idx on public.stock_movements(order_item_id);
create index if not exists stock_movements_reservation_id_idx on public.stock_movements(reservation_id);
create index if not exists stock_movements_movement_source_idx on public.stock_movements(movement_source);

alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_payments enable row level security;
alter table public.store_payment_events enable row level security;
alter table public.store_stock_reservations enable row level security;
alter table public.store_order_logs enable row level security;

revoke all on table
  public.store_orders,
  public.store_order_items,
  public.store_payments,
  public.store_payment_events,
  public.store_stock_reservations,
  public.store_order_logs
from anon, authenticated;

grant all privileges on table
  public.store_orders,
  public.store_order_items,
  public.store_payments,
  public.store_payment_events,
  public.store_stock_reservations,
  public.store_order_logs
to service_role;

grant select, insert, update on table
  public.store_orders,
  public.store_order_items,
  public.store_payments,
  public.store_payment_events,
  public.store_stock_reservations
to authenticated;

grant select, insert on table public.store_order_logs to authenticated;

revoke all on sequence public.store_order_number_seq from public;
revoke all on sequence public.store_order_number_seq from anon;
revoke all on sequence public.store_order_number_seq from authenticated;
grant usage, select on sequence public.store_order_number_seq to service_role;

drop policy if exists store_orders_admin_select on public.store_orders;
create policy store_orders_admin_select on public.store_orders for select to authenticated using (public.is_admin());
drop policy if exists store_orders_admin_insert on public.store_orders;
create policy store_orders_admin_insert on public.store_orders for insert to authenticated with check (public.is_admin());
drop policy if exists store_orders_admin_update on public.store_orders;
create policy store_orders_admin_update on public.store_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists store_orders_admin_delete on public.store_orders;
create policy store_orders_admin_delete on public.store_orders for delete to authenticated using (false);

drop policy if exists store_order_items_admin_select on public.store_order_items;
create policy store_order_items_admin_select on public.store_order_items for select to authenticated using (public.is_admin());
drop policy if exists store_order_items_admin_insert on public.store_order_items;
create policy store_order_items_admin_insert on public.store_order_items for insert to authenticated with check (public.is_admin());
drop policy if exists store_order_items_admin_update on public.store_order_items;
create policy store_order_items_admin_update on public.store_order_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists store_order_items_admin_delete on public.store_order_items;
create policy store_order_items_admin_delete on public.store_order_items for delete to authenticated using (false);

drop policy if exists store_payments_admin_select on public.store_payments;
create policy store_payments_admin_select on public.store_payments for select to authenticated using (public.is_admin());
drop policy if exists store_payments_admin_insert on public.store_payments;
create policy store_payments_admin_insert on public.store_payments for insert to authenticated with check (public.is_admin());
drop policy if exists store_payments_admin_update on public.store_payments;
create policy store_payments_admin_update on public.store_payments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists store_payments_admin_delete on public.store_payments;
create policy store_payments_admin_delete on public.store_payments for delete to authenticated using (false);

drop policy if exists store_payment_events_admin_select on public.store_payment_events;
create policy store_payment_events_admin_select on public.store_payment_events for select to authenticated using (public.is_admin());
drop policy if exists store_payment_events_admin_insert on public.store_payment_events;
create policy store_payment_events_admin_insert on public.store_payment_events for insert to authenticated with check (public.is_admin());
drop policy if exists store_payment_events_admin_update on public.store_payment_events;
create policy store_payment_events_admin_update on public.store_payment_events for update to authenticated using (false);
drop policy if exists store_payment_events_admin_delete on public.store_payment_events;
create policy store_payment_events_admin_delete on public.store_payment_events for delete to authenticated using (false);

drop policy if exists store_stock_reservations_admin_select on public.store_stock_reservations;
create policy store_stock_reservations_admin_select on public.store_stock_reservations for select to authenticated using (public.is_admin());
drop policy if exists store_stock_reservations_admin_insert on public.store_stock_reservations;
create policy store_stock_reservations_admin_insert on public.store_stock_reservations for insert to authenticated with check (public.is_admin());
drop policy if exists store_stock_reservations_admin_update on public.store_stock_reservations;
create policy store_stock_reservations_admin_update on public.store_stock_reservations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists store_stock_reservations_admin_delete on public.store_stock_reservations;
create policy store_stock_reservations_admin_delete on public.store_stock_reservations for delete to authenticated using (false);

drop policy if exists store_order_logs_admin_select on public.store_order_logs;
create policy store_order_logs_admin_select on public.store_order_logs for select to authenticated using (public.is_admin());
drop policy if exists store_order_logs_admin_insert on public.store_order_logs;
create policy store_order_logs_admin_insert on public.store_order_logs for insert to authenticated with check (public.is_admin());
drop policy if exists store_order_logs_admin_update on public.store_order_logs;
create policy store_order_logs_admin_update on public.store_order_logs for update to authenticated using (false);
drop policy if exists store_order_logs_admin_delete on public.store_order_logs;
create policy store_order_logs_admin_delete on public.store_order_logs for delete to authenticated using (false);

commit;
