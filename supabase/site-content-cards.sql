begin;

create table if not exists public.site_content_cards (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  title text not null default '',
  description text not null default '',
  target_url text not null default '',
  image_url text not null default '',
  button_label text not null default 'Assistir',
  content_type text not null default 'link_externo',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_content_cards_slot_key_check check (
    slot_key in ('maintenance_latest', 'gaming_live', 'store_backstage', 'pc_tests')
  ),
  constraint site_content_cards_content_type_check check (
    content_type in ('youtube_nt', 'youtube_gaming', 'instagram', 'tiktok', 'link_externo')
  )
);

create index if not exists site_content_cards_active_sort_idx
  on public.site_content_cards (active, sort_order);

drop trigger if exists site_content_cards_set_updated_at on public.site_content_cards;
create trigger site_content_cards_set_updated_at
before update on public.site_content_cards
for each row execute function public.set_updated_at();

insert into public.site_content_cards (
  slot_key,
  title,
  description,
  target_url,
  image_url,
  button_label,
  content_type,
  active,
  sort_order
)
values
  (
    'maintenance_latest',
    'Últimos vídeos de manutenção',
    '',
    '',
    '',
    'Assistir',
    'youtube_nt',
    true,
    1
  ),
  (
    'gaming_live',
    'Lives da NT Gaming',
    '',
    '',
    '',
    'Assistir',
    'youtube_gaming',
    true,
    2
  ),
  (
    'store_backstage',
    'Bastidores da loja',
    '',
    '',
    '',
    'Assistir',
    'instagram',
    true,
    3
  ),
  (
    'pc_tests',
    'Testes de PCs e games',
    '',
    '',
    '',
    'Assistir',
    'youtube_gaming',
    true,
    4
  )
on conflict (slot_key) do update
set
  title = excluded.title,
  button_label = excluded.button_label,
  content_type = excluded.content_type,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.site_content_cards enable row level security;

drop policy if exists "Public can read active site content cards" on public.site_content_cards;
create policy "Public can read active site content cards"
on public.site_content_cards
for select
to anon, authenticated
using (active = true);

drop policy if exists "Admins can manage site content cards" on public.site_content_cards;
create policy "Admins can manage site content cards"
on public.site_content_cards
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.site_content_cards to anon, authenticated;
grant insert, update, delete on public.site_content_cards to authenticated;

select
  id,
  slot_key,
  title,
  description,
  target_url,
  image_url,
  button_label,
  content_type,
  active,
  sort_order,
  created_at,
  updated_at
from public.site_content_cards
order by sort_order asc;

commit;
