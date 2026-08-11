begin;

-- Bling automation V1:
-- - database changes only enqueue local outbox jobs;
-- - no HTTP/API call is made from triggers;
-- - the worker remains manual through the NT Admin button.

create or replace function public.is_bling_product_draft(p_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(btrim(coalesce(p_status, ''))) = 'rascunho';
$$;

create or replace function public.is_bling_product_catalog_eligible(p_product public.products)
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  return p_product.id is not null
    and not public.is_bling_product_draft(p_product.status)
    and nullif(btrim(coalesce(p_product.sku, '')), '') is not null
    and nullif(btrim(coalesce(p_product.name, '')), '') is not null
    and coalesce(p_product.price, 0) > 0;
end;
$$;

create or replace function public.bling_product_catalog_fields_changed(
  p_old public.products,
  p_new public.products
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  return p_old.name is distinct from p_new.name
    or p_old.sku is distinct from p_new.sku
    or p_old.price is distinct from p_new.price
    or p_old.status is distinct from p_new.status
    or p_old.short_description is distinct from p_new.short_description
    or p_old.full_description is distinct from p_new.full_description
    or p_old.brand is distinct from p_new.brand
    or p_old.model is distinct from p_new.model
    or p_old.warranty is distinct from p_new.warranty;
end;
$$;

create or replace function public.bling_products_before_sync_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_catalog_changed boolean := false;
  v_stock_changed boolean := false;
  v_sku_changed boolean := false;
  v_has_bling_product boolean := false;
begin
  v_has_bling_product := nullif(btrim(coalesce(new.bling_product_id, '')), '') is not null;

  if tg_op = 'INSERT' then
    if public.is_bling_product_draft(new.status) then
      new.bling_sync_status := 'unsupported';
      new.bling_sync_error := '';
      new.bling_sync_metadata := coalesce(new.bling_sync_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'skippedReason', 'draft_product',
          'automationClassifiedAt', now()
        );
    elsif not v_has_bling_product then
      new.bling_sync_status := 'not_sent';
      new.bling_sync_error := '';
    end if;

    return new;
  end if;

  v_catalog_changed := public.bling_product_catalog_fields_changed(old, new);
  v_stock_changed := old.stock is distinct from new.stock;
  v_sku_changed := old.sku is distinct from new.sku;

  if v_catalog_changed then
    if public.is_bling_product_draft(new.status) then
      if new.bling_sync_status <> 'syncing' then
        new.bling_sync_status := 'unsupported';
        new.bling_sync_error := '';
        new.bling_sync_metadata := coalesce(new.bling_sync_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'skippedReason', 'draft_product',
            'automationClassifiedAt', now()
          );
      end if;
    elsif v_has_bling_product and v_sku_changed then
      if new.bling_sync_status <> 'syncing' then
        new.bling_sync_status := 'review_required';
        new.bling_sync_error := 'SKU alterado em produto ja vinculado ao Bling. Revisao administrativa necessaria antes de sincronizar.';
        new.bling_sync_metadata := coalesce(new.bling_sync_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'reviewReason', 'linked_product_sku_changed',
            'previousSku', old.sku,
            'newSku', new.sku,
            'automationClassifiedAt', now()
          );
      end if;
    elsif not v_has_bling_product and public.is_bling_product_catalog_eligible(new) then
      if new.bling_sync_status <> 'syncing' then
        new.bling_sync_status := 'not_sent';
        new.bling_sync_error := '';
        new.bling_sync_metadata := coalesce(new.bling_sync_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'automationReason', 'catalog_changed_unlinked_product',
            'automationClassifiedAt', now()
          );
      end if;
    elsif not v_has_bling_product then
      if new.bling_sync_status <> 'syncing' then
        new.bling_sync_status := 'unsupported';
        new.bling_sync_error := '';
        new.bling_sync_metadata := coalesce(new.bling_sync_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'skippedReason', 'catalog_not_eligible',
            'automationClassifiedAt', now()
          );
      end if;
    elsif new.bling_sync_status not in ('syncing', 'review_required') then
      -- Existing product update by PUT/PATCH is not enabled in V1.
      -- Keep the local state visible without enqueueing a job that cannot update Bling yet.
      new.bling_sync_status := 'dirty';
      new.bling_sync_error := '';
      new.bling_sync_metadata := coalesce(new.bling_sync_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'automationReason', 'linked_product_catalog_changed_update_pending',
          'automationClassifiedAt', now()
        );
    end if;
  end if;

  if v_stock_changed and v_has_bling_product and new.bling_stock_sync_status <> 'syncing' then
    new.bling_stock_sync_status := 'dirty';
    new.bling_stock_sync_error := '';
    new.bling_stock_sync_metadata := coalesce(new.bling_stock_sync_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'automationReason', 'stock_changed',
        'previousStock', old.stock,
        'newStock', new.stock,
        'automationClassifiedAt', now()
      );
  end if;

  return new;
end;
$$;

create or replace function public.bling_products_after_sync_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_catalog_changed boolean := false;
  v_stock_changed boolean := false;
  v_sku_changed boolean := false;
  v_has_bling_product boolean := false;
  v_had_bling_product boolean := false;
begin
  v_has_bling_product := nullif(btrim(coalesce(new.bling_product_id, '')), '') is not null;

  if tg_op = 'INSERT' then
    if public.is_bling_product_catalog_eligible(new) and not v_has_bling_product then
      perform public.enqueue_bling_sync_job(
        'product',
        new.id,
        'product_sync',
        100,
        now(),
        jsonb_build_object(
          'source', 'products_trigger',
          'reason', 'product_inserted',
          'createdAt', now()
        )
      );
    elsif v_has_bling_product then
      perform public.enqueue_bling_sync_job(
        'product',
        new.id,
        'stock_sync',
        20,
        now(),
        jsonb_build_object(
          'source', 'products_trigger',
          'reason', 'linked_product_inserted_stock_check',
          'createdAt', now()
        )
      );
    end if;

    return null;
  end if;

  v_had_bling_product := nullif(btrim(coalesce(old.bling_product_id, '')), '') is not null;
  v_catalog_changed := public.bling_product_catalog_fields_changed(old, new);
  v_stock_changed := old.stock is distinct from new.stock;
  v_sku_changed := old.sku is distinct from new.sku;

  if v_catalog_changed
    and not v_has_bling_product
    and public.is_bling_product_catalog_eligible(new)
  then
    perform public.enqueue_bling_sync_job(
      'product',
      new.id,
      'product_sync',
      100,
      now(),
      jsonb_build_object(
        'source', 'products_trigger',
        'reason', 'catalog_changed_unlinked_product',
        'createdAt', now()
      )
    );
  end if;

  if v_catalog_changed
    and v_has_bling_product
    and not v_sku_changed
    and new.bling_sync_status = 'dirty'
  then
    -- Product update for already linked products is intentionally not enqueued in V1.
    -- The worker currently creates/links products, but does not PUT/PATCH existing Bling products.
    null;
  end if;

  if v_stock_changed and v_has_bling_product then
    perform public.enqueue_bling_sync_job(
      'product',
      new.id,
      'stock_sync',
      20,
      now(),
      jsonb_build_object(
        'source', 'products_trigger',
        'reason', 'stock_changed',
        'previousStock', old.stock,
        'newStock', new.stock,
        'createdAt', now()
      )
    );
  end if;

  if not v_had_bling_product and v_has_bling_product then
    perform public.enqueue_bling_sync_job(
      'product',
      new.id,
      'stock_sync',
      20,
      now(),
      jsonb_build_object(
        'source', 'products_trigger',
        'reason', 'product_linked_stock_check',
        'createdAt', now()
      )
    );
  end if;

  return null;
end;
$$;

drop trigger if exists products_bling_sync_automation_before on public.products;
create trigger products_bling_sync_automation_before
before insert or update on public.products
for each row
execute function public.bling_products_before_sync_automation();

drop trigger if exists products_bling_sync_automation_after on public.products;
create trigger products_bling_sync_automation_after
after insert or update on public.products
for each row
execute function public.bling_products_after_sync_automation();

revoke all on function public.is_bling_product_draft(text) from public, anon, authenticated;
revoke all on function public.is_bling_product_catalog_eligible(public.products) from public, anon, authenticated;
revoke all on function public.bling_product_catalog_fields_changed(public.products, public.products) from public, anon, authenticated;
revoke all on function public.bling_products_before_sync_automation() from public, anon, authenticated;
revoke all on function public.bling_products_after_sync_automation() from public, anon, authenticated;

grant execute on function public.is_bling_product_draft(text) to service_role;
grant execute on function public.is_bling_product_catalog_eligible(public.products) to service_role;
grant execute on function public.bling_product_catalog_fields_changed(public.products, public.products) to service_role;
grant execute on function public.bling_products_before_sync_automation() to service_role;
grant execute on function public.bling_products_after_sync_automation() to service_role;

commit;
