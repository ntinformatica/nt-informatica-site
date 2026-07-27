alter table public.assembled_pcs
  add column if not exists show_benchmark_section boolean not null default false,
  add column if not exists nt_testa_episode text not null default '',
  add column if not exists full_benchmark_video_url text not null default '',
  add column if not exists benchmark_games jsonb not null default '[]'::jsonb;

update public.assembled_pcs
set show_benchmark_section = true
where jsonb_array_length(coalesce(benchmark_games, '[]'::jsonb)) > 0
  and show_benchmark_section = false;

update public.assembled_pcs
set show_benchmark_section = true
where cardinality(coalesce(recommended_games, '{}'::text[])) > 0
  and show_benchmark_section = false;

create index if not exists assembled_pcs_benchmark_games_gin_idx
  on public.assembled_pcs
  using gin (benchmark_games);
