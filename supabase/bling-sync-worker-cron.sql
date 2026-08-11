begin;

-- Bling worker automatic V1.
-- This schedules the existing Edge Function worker every minute.
-- No secret value is stored in this file. Required secrets must exist in Supabase Vault:
-- - project_url: https://jxrayrlxegcqbxrlpzem.supabase.co
-- - publishable_key: Supabase publishable/anon key accepted by the Edge Functions gateway
-- - bling_worker_cron_secret: same value configured as Edge Function secret BLING_WORKER_CRON_SECRET

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise exception 'Supabase Vault nao esta disponivel. Crie os secrets no Vault antes de agendar o worker Bling.';
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Secret project_url ausente no Supabase Vault.';
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'publishable_key') then
    raise exception 'Secret publishable_key ausente no Supabase Vault.';
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'bling_worker_cron_secret') then
    raise exception 'Secret bling_worker_cron_secret ausente no Supabase Vault.';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'bling-process-sync-jobs-every-minute'
  ) then
    perform cron.unschedule('bling-process-sync-jobs-every-minute');
  end if;
end;
$$;

select cron.schedule(
  'bling-process-sync-jobs-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
      limit 1
    ) || '/functions/v1/bling-process-sync-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'publishable_key'
        limit 1
      ),
      'x-nt-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'bling_worker_cron_secret'
        limit 1
      )
    ),
    body := jsonb_build_object(
      'source', 'cron',
      'limit', 5,
      'time', now()
    ),
    timeout_milliseconds := 25000
  ) as request_id;
  $$
);

commit;
