begin;

alter table public.products
  add column if not exists fiscal_ncm text,
  add column if not exists fiscal_origin_code text,
  add column if not exists fiscal_review_status text not null default 'incomplete',
  add column if not exists fiscal_source text,
  add column if not exists fiscal_reviewed_at timestamptz,
  add column if not exists fiscal_imported_from_bling_at timestamptz,
  add column if not exists fiscal_metadata jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_fiscal_ncm_check;

alter table public.products
  add constraint products_fiscal_ncm_check
  check (
    fiscal_ncm is null
    or btrim(fiscal_ncm) = ''
    or fiscal_ncm ~ '^[0-9]{8}$'
  );

alter table public.products
  drop constraint if exists products_fiscal_origin_code_check;

alter table public.products
  add constraint products_fiscal_origin_code_check
  check (
    fiscal_origin_code is null
    or btrim(fiscal_origin_code) = ''
    or fiscal_origin_code in ('0', '1', '2', '3', '4', '5', '6', '7', '8')
  );

alter table public.products
  drop constraint if exists products_fiscal_review_status_check;

alter table public.products
  add constraint products_fiscal_review_status_check
  check (fiscal_review_status in ('incomplete', 'complete', 'divergent'));

create index if not exists products_fiscal_review_status_idx
  on public.products(fiscal_review_status);

create index if not exists products_fiscal_ncm_idx
  on public.products(fiscal_ncm)
  where fiscal_ncm is not null and btrim(fiscal_ncm) <> '';

commit;
