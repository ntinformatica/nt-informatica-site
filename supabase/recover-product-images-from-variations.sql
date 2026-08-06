begin;

with affected_products(slug) as (
  values
    ('mouse-attack-shark-x11-tri-mode'),
    ('mouse-marvo-capo-20-m292'),
    ('mouse-logitech-g203-lightsync'),
    ('mouse-logitech-g305-lightspeed'),
    ('mouse-redragon-cobra-m711'),
    ('mouse-smailwolf-rs7-tri-mode'),
    ('headset-mchose-v9-turbo'),
    ('headset-mchose-v9-pro'),
    ('headset-mchose-x9'),
    ('headset-redragon-zeus-x-h510'),
    ('headset-marvo-tactic-20-40'),
    ('gabinete-mancer-cv100'),
    ('gabinete-mancer-cv100-purple-edition'),
    ('controle-ps5-dualsense'),
    ('controle-xbox-series'),
    ('controle-gamesir-nova-lite-t4'),
    ('controle-gamesir-cyclone-2')
),
variation_images as (
  select
    product.id as product_id,
    product.slug,
    row_number() over (
      partition by product.id
      order by variation.created_at nulls last, variation.id
    ) * 1000 + image_item.ordinality as image_order,
    case
      when image_item.image_url ~* '^https?://' then image_item.image_url
      when image_item.image_url like '/produtos/%' then image_item.image_url
      when image_item.image_url like 'assets/%' then '/produtos/' || image_item.image_url
      else image_item.image_url
    end as image_url
  from public.products as product
  join affected_products as affected on affected.slug = product.slug
  join public.product_variations as variation on variation.product_id = product.id
  cross join lateral unnest(
    array_remove(
      array_prepend(nullif(btrim(coalesce(variation.image, '')), ''), coalesce(variation.images, array[]::text[])),
      null
    )
  ) with ordinality as image_item(image_url, ordinality)
  where nullif(btrim(coalesce(image_item.image_url, '')), '') is not null
),
deduplicated_images as (
  select
    product_id,
    slug,
    image_url,
    min(image_order) as first_seen
  from variation_images
  where image_url ~* '^(https?://|/produtos/)'
  group by product_id, slug, image_url
),
recovered as (
  select
    product_id,
    slug,
    (array_agg(image_url order by first_seen))[1] as main_image,
    array_agg(image_url order by first_seen)::text[] as images
  from deduplicated_images
  group by product_id, slug
)
update public.products as product
set
  main_image = recovered.main_image,
  images = recovered.images,
  updated_at = now()
from recovered
where product.id = recovered.product_id
  and nullif(btrim(coalesce(product.main_image, '')), '') is null
  and coalesce(array_length(product.images, 1), 0) = 0;

with affected_products(slug) as (
  values
    ('mouse-attack-shark-x11-tri-mode'),
    ('mouse-marvo-capo-20-m292'),
    ('mouse-logitech-g203-lightsync'),
    ('mouse-logitech-g305-lightspeed'),
    ('mouse-redragon-cobra-m711'),
    ('mouse-smailwolf-rs7-tri-mode'),
    ('headset-mchose-v9-turbo'),
    ('headset-mchose-v9-pro'),
    ('headset-mchose-x9'),
    ('headset-redragon-zeus-x-h510'),
    ('headset-marvo-tactic-20-40'),
    ('gabinete-mancer-cv100'),
    ('gabinete-mancer-cv100-purple-edition'),
    ('controle-ps5-dualsense'),
    ('controle-xbox-series'),
    ('controle-gamesir-nova-lite-t4'),
    ('controle-gamesir-cyclone-2')
)
select
  product.slug,
  product.name,
  product.main_image,
  coalesce(array_length(product.images, 1), 0) as images_count
from public.products as product
join affected_products as affected on affected.slug = product.slug
order by product.name;

select
  count(*) as products_with_legacy_asset_paths
from public.products as product
where product.main_image like 'assets/%'
  or exists (
    select 1
    from unnest(coalesce(product.images, array[]::text[])) as image_item(image_url)
    where image_item.image_url like 'assets/%'
  );

with products_to_normalize as (
  select
    product.id,
    product.slug,
    product.name,
    product.main_image as old_main_image,
    product.images as old_images,
    case
      when product.main_image like 'assets/%' then '/produtos/' || product.main_image
      else product.main_image
    end as normalized_main_image,
    coalesce(
      array_agg(
        case
          when image_item.image_url like 'assets/%' then '/produtos/' || image_item.image_url
          else image_item.image_url
        end
        order by image_item.ordinality
      ) filter (where image_item.image_url is not null),
      array[]::text[]
    ) as normalized_images
  from public.products as product
  left join lateral unnest(coalesce(product.images, array[]::text[])) with ordinality as image_item(image_url, ordinality) on true
  where product.main_image like 'assets/%'
    or exists (
      select 1
      from unnest(coalesce(product.images, array[]::text[])) as legacy_image(image_url)
      where legacy_image.image_url like 'assets/%'
    )
  group by product.id, product.slug, product.name, product.main_image, product.images
),
updated_products as (
  update public.products as product
  set
    main_image = products_to_normalize.normalized_main_image,
    images = products_to_normalize.normalized_images,
    updated_at = now()
  from products_to_normalize
  where product.id = products_to_normalize.id
  returning
    product.slug,
    product.name,
    products_to_normalize.old_main_image,
    product.main_image as new_main_image,
    products_to_normalize.old_images,
    product.images as new_images,
    coalesce(array_length(product.images, 1), 0) as images_count
)
select *
from updated_products
order by name;

commit;
