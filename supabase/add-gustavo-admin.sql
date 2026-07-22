begin;

do $$
declare
  v_user_id uuid := 'be831825-2353-480d-a248-1adad2c15c7e';
  v_email text := 'gustavodosanjos999@gmail.com';
  v_name text := 'Gustavo dos Anjos';
  v_role text := 'administrador';
  v_cols text[] := array['user_id'];
  v_vals text[] := array[quote_literal(v_user_id::text) || '::uuid'];
  v_updates text[] := array[]::text[];
begin
  if to_regclass('public.admin_users') is null then
    raise exception 'Tabela public.admin_users não encontrada.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'user_id'
  ) then
    raise exception 'Coluna public.admin_users.user_id não encontrada.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'email'
  ) then
    v_cols := array_append(v_cols, 'email');
    v_vals := array_append(v_vals, quote_literal(v_email));
    v_updates := array_append(v_updates, 'email = excluded.email');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'name'
  ) then
    v_cols := array_append(v_cols, 'name');
    v_vals := array_append(v_vals, quote_literal(v_name));
    v_updates := array_append(v_updates, 'name = excluded.name');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'role'
  ) then
    v_cols := array_append(v_cols, 'role');
    v_vals := array_append(v_vals, quote_literal(v_role));
    v_updates := array_append(v_updates, 'role = excluded.role');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'profile'
  ) then
    v_cols := array_append(v_cols, 'profile');
    v_vals := array_append(v_vals, quote_literal(v_role));
    v_updates := array_append(v_updates, 'profile = excluded.profile');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'active'
  ) then
    v_cols := array_append(v_cols, 'active');
    v_vals := array_append(v_vals, 'true');
    v_updates := array_append(v_updates, 'active = excluded.active');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'created_at'
  ) then
    v_cols := array_append(v_cols, 'created_at');
    v_vals := array_append(v_vals, 'now()');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
      and column_name = 'updated_at'
  ) then
    v_cols := array_append(v_cols, 'updated_at');
    v_vals := array_append(v_vals, 'now()');
    v_updates := array_append(v_updates, 'updated_at = now()');
  end if;

  execute format(
    'insert into public.admin_users (%s) values (%s) on conflict (user_id) do update set %s',
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', '),
    case
      when array_length(v_updates, 1) > 0 then array_to_string(v_updates, ', ')
      else 'user_id = excluded.user_id'
    end
  );
end $$;

commit;
