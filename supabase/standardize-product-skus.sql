-- Padronizacao segura de SKUs de produtos para integracao futura com Bling.
-- Arquivo de registro/auditoria do procedimento executado manualmente no Supabase.
-- Escopo: somente os dois produtos abaixo, preservando IDs e todos os demais dados.

begin;

-- ============================================================
-- BLOCO 1 - DIAGNOSTICO ANTES
-- ============================================================
-- Diagnostico dos dois produtos confirmados no Supabase de producao.
-- Antes da manutencao, os SKUs eram:
-- 18a37479-9f49-43b3-96c8-31bf12d7580c: TUF GAMING A620AM-PLUS
-- f9354477-5806-4662-bb56-e98660cfbf4d: AURA GL360 V2

with target_products(id, old_sku, new_sku) as (
  values
    (
      '18a37479-9f49-43b3-96c8-31bf12d7580c'::uuid,
      'TUF GAMING A620AM-PLUS',
      'TUF-GAMING-A620AM-PLUS'
    ),
    (
      'f9354477-5806-4662-bb56-e98660cfbf4d'::uuid,
      'AURA GL360 V2',
      'AURA-GL360-V2'
    )
)
select
  p.id,
  p.name,
  p.sku,
  t.old_sku as sku_antigo_documentado,
  t.new_sku as sku_novo_esperado,
  p.category_id,
  c.name as categoria,
  p.status
from target_products t
left join public.products p on p.id = t.id
left join public.categories c on c.id = p.category_id
order by p.name;

-- ============================================================
-- BLOCO 2 - VERIFICACAO DE CONFLITOS
-- ============================================================
-- Verifica se existe outra linha usando os novos SKUs.
-- Resultado esperado: zero linhas.
-- Se retornar qualquer linha, pare e nao execute o BLOCO 3.

with target_products(id, new_sku) as (
  values
    ('18a37479-9f49-43b3-96c8-31bf12d7580c'::uuid, 'TUF-GAMING-A620AM-PLUS'),
    ('f9354477-5806-4662-bb56-e98660cfbf4d'::uuid, 'AURA-GL360-V2')
),
target_skus(new_sku) as (
  select new_sku from target_products
)
select
  'products' as origem,
  p.id,
  p.name as item,
  p.sku
from public.products p
join target_skus t on btrim(coalesce(p.sku, '')) = t.new_sku
where not exists (
  select 1
  from target_products target
  where target.id = p.id
    and target.new_sku = btrim(coalesce(p.sku, ''))
)
union all
select
  'product_variations' as origem,
  v.id,
  concat_ws(
    ' - ',
    p.name,
    nullif(btrim(concat_ws(' ', nullif(v.name, ''), nullif(v.value, ''), nullif(v.color, ''))), '')
  ) as item,
  v.sku
from public.product_variations v
join public.products p on p.id = v.product_id
join target_skus t on btrim(coalesce(v.sku, '')) = t.new_sku
order by origem, item;

-- ============================================================
-- BLOCO 3 - UPDATE SEGURO
-- ============================================================
-- Atualiza somente sku e updated_at dos dois produtos por ID exato.
-- Nao altera id, name, category_id, estoque, preco, descricoes, imagens,
-- status, variacoes ou qualquer outro produto.

with sku_updates(id, old_sku, new_sku) as (
  values
    (
      '18a37479-9f49-43b3-96c8-31bf12d7580c'::uuid,
      'TUF GAMING A620AM-PLUS',
      'TUF-GAMING-A620AM-PLUS'
    ),
    (
      'f9354477-5806-4662-bb56-e98660cfbf4d'::uuid,
      'AURA GL360 V2',
      'AURA-GL360-V2'
    )
),
sku_conflicts as (
  select
    u.id as target_id,
    u.new_sku,
    'products' as origem,
    p.id::text as conflict_id,
    p.name as conflict_item,
    p.sku as conflict_sku
  from sku_updates u
  join public.products p
    on btrim(coalesce(p.sku, '')) = u.new_sku
   and p.id <> u.id
  union all
  select
    u.id as target_id,
    u.new_sku,
    'product_variations' as origem,
    v.id::text as conflict_id,
    concat_ws(
      ' - ',
      p.name,
      nullif(btrim(concat_ws(' ', nullif(v.name, ''), nullif(v.value, ''), nullif(v.color, ''))), '')
    ) as conflict_item,
    v.sku as conflict_sku
  from sku_updates u
  join public.product_variations v
    on btrim(coalesce(v.sku, '')) = u.new_sku
  join public.products p on p.id = v.product_id
),
updated as (
  update public.products p
  set
    sku = u.new_sku,
    updated_at = now()
  from sku_updates u
  where p.id = u.id
    and btrim(coalesce(p.sku, '')) in (u.old_sku, u.new_sku)
    and not exists (
      select 1
      from sku_conflicts conflict
      where conflict.target_id = u.id
    )
  returning
    p.id,
    p.name,
    u.old_sku as sku_antigo_documentado,
    p.sku as sku_atual
)
select
  'UPDATED_OR_ALREADY_STANDARDIZED' as resultado,
  id,
  name,
  sku_antigo_documentado,
  sku_atual
from updated
union all
select
  'NOT_FOUND_OR_BLOCKED' as resultado,
  u.id,
  coalesce(p.name, 'Produto nao encontrado') as name,
  u.old_sku as sku_antigo_documentado,
  coalesce(p.sku, '') as sku_atual
from sku_updates u
left join public.products p on p.id = u.id
where not exists (
    select 1
    from updated updated_row
    where updated_row.id = u.id
  )
order by resultado, name;

-- ============================================================
-- BLOCO 4 - CONFERENCIA DEPOIS
-- ============================================================
-- Resultado esperado atual:
-- 18a37479-9f49-43b3-96c8-31bf12d7580c: TUF-GAMING-A620AM-PLUS
-- f9354477-5806-4662-bb56-e98660cfbf4d: AURA-GL360-V2

select
  p.id,
  p.name,
  p.sku,
  p.category_id,
  c.name as categoria,
  p.status
from public.products p
left join public.categories c on c.id = p.category_id
where p.id in (
  '18a37479-9f49-43b3-96c8-31bf12d7580c'::uuid,
  'f9354477-5806-4662-bb56-e98660cfbf4d'::uuid
)
order by p.name;

-- ============================================================
-- BLOCO 5 - AUDITORIA FINAL
-- ============================================================
-- Resumo esperado informado pela auditoria:
-- total_produtos = 143
-- sem_sku = 0
-- grupos_sku_duplicados = 0
-- sku_com_espacos = 0
-- sku_com_caracteres_especiais = 0

with duplicate_product_skus as (
  select btrim(sku) as sku
  from public.products
  where nullif(btrim(coalesce(sku, '')), '') is not null
  group by btrim(sku)
  having count(*) > 1
)
select
  count(*)::integer as total_produtos,
  count(*) filter (
    where nullif(btrim(coalesce(sku, '')), '') is null
  )::integer as sem_sku,
  (select count(*)::integer from duplicate_product_skus) as grupos_sku_duplicados,
  count(*) filter (
    where coalesce(sku, '') ~ '[[:space:]]'
  )::integer as sku_com_espacos,
  count(*) filter (
    where nullif(btrim(coalesce(sku, '')), '') is not null
      and btrim(sku) !~ '^[A-Za-z0-9._-]+$'
  )::integer as sku_com_caracteres_especiais
from public.products;

-- Verificacao final de colisao entre products e product_variations.
-- Resultado esperado: zero linhas.

with all_skus as (
  select
    'products' as origem,
    p.id,
    p.name as item,
    btrim(p.sku) as sku
  from public.products p
  where nullif(btrim(coalesce(p.sku, '')), '') is not null
  union all
  select
    'product_variations' as origem,
    v.id,
    concat_ws(
      ' - ',
      p.name,
      nullif(btrim(concat_ws(' ', nullif(v.name, ''), nullif(v.value, ''), nullif(v.color, ''))), '')
    ) as item,
    btrim(v.sku) as sku
  from public.product_variations v
  join public.products p on p.id = v.product_id
  where nullif(btrim(coalesce(v.sku, '')), '') is not null
),
duplicated_skus as (
  select sku
  from all_skus
  group by sku
  having count(*) > 1
)
select
  s.origem,
  s.id,
  s.item,
  s.sku
from all_skus s
join duplicated_skus d on d.sku = s.sku
order by s.sku, s.origem, s.item;

commit;
