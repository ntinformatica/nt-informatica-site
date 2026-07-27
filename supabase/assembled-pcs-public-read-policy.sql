begin;

alter table public.assembled_pcs enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table public.assembled_pcs to anon, authenticated;
grant insert, update, delete on table public.assembled_pcs to authenticated;

drop policy if exists assembled_pcs_public_select_published on public.assembled_pcs;
create policy assembled_pcs_public_select_published
  on public.assembled_pcs
  for select
  to anon, authenticated
  using (
    published is true
    and coalesce(status, '') not in ('rascunho', 'desativado')
  );

drop policy if exists assembled_pcs_admin_select on public.assembled_pcs;
create policy assembled_pcs_admin_select
  on public.assembled_pcs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists assembled_pcs_admin_insert on public.assembled_pcs;
create policy assembled_pcs_admin_insert
  on public.assembled_pcs
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists assembled_pcs_admin_update on public.assembled_pcs;
create policy assembled_pcs_admin_update
  on public.assembled_pcs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists assembled_pcs_admin_delete on public.assembled_pcs;
create policy assembled_pcs_admin_delete
  on public.assembled_pcs
  for delete
  to authenticated
  using (public.is_admin());

commit;
