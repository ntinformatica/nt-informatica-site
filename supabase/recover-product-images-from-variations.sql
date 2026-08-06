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

commit;
