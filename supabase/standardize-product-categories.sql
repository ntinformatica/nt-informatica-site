-- =========================================================
-- PADRONIZACAO DE 2 CATEGORIAS PARA BLING
-- NT Informatica, Celulares e Games
-- =========================================================
--
-- Estado real confirmado antes da execucao:
-- - Air Coolers / air-coolers ja esta padronizada: nao alterar.
-- - Headsets / headsets ja esta padronizada: nao alterar.
-- - Mouses / mouses ja esta padronizada: nao alterar.
--
-- Objetivo deste arquivo:
-- - Alterar somente name e slug das 2 categorias pendentes.
-- - Preservar os IDs atuais das categorias.
-- - Preservar products.category_id.
-- - Nao criar, excluir ou mover categorias/produtos.
--
-- Categorias a alterar:
-- 1. Kit Perifericos
--    id confirmado: 47f4f3da-b829-4ed7-8350-5f03190d244d
--    slug real atual: kit-perifericos
--    novo name: Kits de Periféricos
--    novo slug: kits-de-perifericos
--
-- 2. SSDs
--    id confirmado: 877d1ce4-a5a7-4b58-8fc1-fdacc682583e
--    slug real atual: ssds
--    novo name: Armazenamento
--    novo slug: armazenamento
--
-- Uso recomendado no Supabase SQL Editor:
-- 1. Execute o BLOCO 1 e o BLOCO 2 para conferir antes.
-- 2. Se nao houver conflitos no BLOCO 2, execute o BLOCO 3.
-- 3. Execute o BLOCO 4 e o BLOCO 5 para conferir depois.
--
-- Observacao:
-- Este arquivo nao deve ser executado automaticamente por Codex.
-- =========================================================


-- =========================================================
-- BLOCO 1 - DIAGNOSTICO ANTES DA ALTERACAO
-- SELECT somente leitura para conferir IDs e produtos vinculados.
--
-- Resultado esperado antes do UPDATE:
-- - Kit Periféricos / kit-perifericos = 6 produtos
-- - SSDs / ssds = 5 produtos
-- =========================================================

select
  c.id,
  c.name,
  c.slug,
  c.active,
  count(p.id) as quantidade_produtos
from public.categories c
left join public.products p
  on p.category_id = c.id
where c.slug in (
  'kit-perifericos',
  'ssds'
)
group by
  c.id,
  c.name,
  c.slug,
  c.active
order by
  c.name;


-- =========================================================
-- BLOCO 2 - VERIFICACAO DE CONFLITOS
-- Procura OUTRA categoria usando qualquer name/slug novo.
--
-- Resultado esperado:
-- - zero linhas.
--
-- Se retornar linhas, NAO execute o BLOCO 3 antes de revisar.
-- =========================================================

with target_categories as (
  select *
  from (
    values
      ('kit-perifericos', 'Kit Periféricos', 'Kits de Periféricos', 'kits-de-perifericos'),
      ('ssds', 'SSDs', 'Armazenamento', 'armazenamento')
  ) as t(old_slug, old_name, new_name, new_slug)
),
current_targets as (
  select
    t.old_slug,
    t.old_name,
    t.new_name,
    t.new_slug,
    c.id as target_category_id
  from target_categories t
  left join public.categories c
    on c.slug = t.old_slug
)
select
  ct.old_slug as categoria_a_alterar,
  ct.new_name as novo_name_desejado,
  ct.new_slug as novo_slug_desejado,
  c.id as categoria_conflitante_id,
  c.name as categoria_conflitante_name,
  c.slug as categoria_conflitante_slug,
  case
    when c.slug = ct.new_slug then 'slug'
    when lower(trim(c.name)) = lower(trim(ct.new_name)) then 'name'
    else 'desconhecido'
  end as tipo_conflito
from current_targets ct
join public.categories c
  on (
    c.slug = ct.new_slug
    or lower(trim(c.name)) = lower(trim(ct.new_name))
  )
where ct.target_category_id is not null
  and c.id <> ct.target_category_id
order by
  ct.old_slug,
  tipo_conflito;


-- =========================================================
-- BLOCO 3 - UPDATE SEGURO
-- Altera SOMENTE name e slug das linhas encontradas pelos slugs reais atuais.
--
-- Protecoes:
-- - nao altera ID;
-- - nao altera products.category_id;
-- - nao cria categorias;
-- - nao exclui categorias;
-- - nao move produtos;
-- - nao altera estoque;
-- - nao altera produtos;
-- - nao altera variacoes;
-- - nao toca em Air Coolers;
-- - nao toca em Headsets;
-- - nao toca em Mouses;
-- - nao toca nas outras 15 categorias;
-- - se houver conflito de name/slug novo com outra categoria, a linha
--   correspondente nao sera atualizada.
--
-- A coluna updated_at podera ser atualizada automaticamente por trigger,
-- caso o trigger set_updated_at esteja ativo no banco. Este UPDATE altera
-- explicitamente apenas name e slug.
-- =========================================================

begin;

with target_categories as (
  select *
  from (
    values
      ('kit-perifericos', 'Kits de Periféricos', 'kits-de-perifericos'),
      ('ssds', 'Armazenamento', 'armazenamento')
  ) as t(old_slug, new_name, new_slug)
),
candidates as (
  select
    t.old_slug,
    t.new_name,
    t.new_slug,
    c.id as category_id,
    c.name as current_name,
    c.slug as current_slug
  from target_categories t
  left join public.categories c
    on c.slug = t.old_slug
),
blocked as (
  select
    cand.old_slug,
    cand.new_name,
    cand.new_slug,
    cand.category_id,
    conflict.id as conflicting_category_id,
    conflict.name as conflicting_category_name,
    conflict.slug as conflicting_category_slug
  from candidates cand
  join public.categories conflict
    on (
      conflict.slug = cand.new_slug
      or lower(trim(conflict.name)) = lower(trim(cand.new_name))
    )
  where cand.category_id is not null
    and conflict.id <> cand.category_id
),
updated as (
  update public.categories c
  set
    name = cand.new_name,
    slug = cand.new_slug
  from candidates cand
  where c.id = cand.category_id
    and not exists (
      select 1
      from blocked b
      where b.old_slug = cand.old_slug
    )
  returning
    c.id,
    cand.old_slug,
    cand.current_name,
    cand.current_slug,
    c.name as new_name,
    c.slug as new_slug
)
select
  'UPDATED' as status,
  u.id,
  u.old_slug,
  u.current_name,
  u.current_slug,
  u.new_name,
  u.new_slug
from updated u

union all

select
  case
    when cand.category_id is null then 'NOT_FOUND_OLD_SLUG'
    when exists (
      select 1
      from blocked b
      where b.old_slug = cand.old_slug
    ) then 'BLOCKED_CONFLICT'
    else 'NOT_UPDATED'
  end as status,
  cand.category_id as id,
  cand.old_slug,
  cand.current_name,
  cand.current_slug,
  cand.new_name,
  cand.new_slug
from candidates cand
where not exists (
  select 1
  from updated u
  where u.old_slug = cand.old_slug
)
order by
  old_slug,
  status;

commit;


-- =========================================================
-- BLOCO 4 - CONFERENCIA DEPOIS
-- SELECT mostrando as duas categorias ja com os novos nomes/slugs.
--
-- Resultado esperado depois do UPDATE:
-- - Kits de Periféricos / kits-de-perifericos = 6 produtos
-- - Armazenamento / armazenamento = 5 produtos
--
-- Os IDs devem ser os mesmos encontrados no BLOCO 1.
-- =========================================================

select
  c.id,
  c.name,
  c.slug,
  c.active,
  count(p.id) as quantidade_produtos
from public.categories c
left join public.products p
  on p.category_id = c.id
where c.slug in (
  'kits-de-perifericos',
  'armazenamento'
)
group by
  c.id,
  c.name,
  c.slug,
  c.active
order by
  c.name;


-- =========================================================
-- BLOCO 5 - AUDITORIA DE VINCULOS
-- Confirma se existem produtos sem categoria apos a operacao.
--
-- Resultado esperado:
-- - zero linhas.
-- =========================================================

select
  p.id,
  p.name,
  p.slug,
  p.sku,
  p.category_id,
  p.status
from public.products p
where p.category_id is null
order by
  p.name;


-- =========================================================
-- BLOCO 5B - RESUMO DE PRODUTOS SEM CATEGORIA
-- Resultado esperado:
-- - total_produtos_sem_categoria = 0
-- =========================================================

select
  count(*) as total_produtos_sem_categoria
from public.products
where category_id is null;
