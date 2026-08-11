begin;

create table if not exists public.bling_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  status text not null default 'pending',
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bling_sync_jobs_entity_type_check
    check (entity_type in ('product')),
  constraint bling_sync_jobs_operation_check
    check (operation in ('product_sync', 'stock_sync')),
  constraint bling_sync_jobs_status_check
    check (status in ('pending', 'processing', 'done', 'error', 'dead', 'skipped')),
  constraint bling_sync_jobs_attempts_check
    check (attempts >= 0 and max_attempts > 0),
  constraint bling_sync_jobs_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

drop index if exists public.bling_sync_jobs_pending_entity_operation_uidx;
drop index if exists public.bling_sync_jobs_active_entity_operation_uidx;

create unique index if not exists bling_sync_jobs_pending_entity_operation_uidx
  on public.bling_sync_jobs(entity_type, entity_id, operation)
  where status = 'pending';

create index if not exists bling_sync_jobs_queue_idx
  on public.bling_sync_jobs(status, priority, available_at, created_at);

create index if not exists bling_sync_jobs_entity_idx
  on public.bling_sync_jobs(entity_type, entity_id);

alter table public.bling_sync_jobs enable row level security;

drop policy if exists "bling_sync_jobs_no_client_access" on public.bling_sync_jobs;

create policy "bling_sync_jobs_no_client_access"
  on public.bling_sync_jobs
  for all
  using (false)
  with check (false);

create or replace function public.enqueue_bling_sync_job(
  p_entity_type text,
  p_entity_id uuid,
  p_operation text,
  p_priority integer default 100,
  p_available_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns public.bling_sync_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.bling_sync_jobs;
begin
  if p_entity_type <> 'product' then
    raise exception 'entity_type invalido';
  end if;

  if p_operation not in ('product_sync', 'stock_sync') then
    raise exception 'operation invalida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', p_entity_type, p_entity_id::text, p_operation), 0)
  );

  insert into public.bling_sync_jobs (
    entity_type,
    entity_id,
    operation,
    status,
    priority,
    available_at,
    metadata
  )
  values (
    p_entity_type,
    p_entity_id,
    p_operation,
    'pending',
    coalesce(p_priority, 100),
    coalesce(p_available_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (entity_type, entity_id, operation)
    where status = 'pending'
  do update set
    priority = least(public.bling_sync_jobs.priority, excluded.priority),
    available_at = least(public.bling_sync_jobs.available_at, excluded.available_at),
    metadata = coalesce(public.bling_sync_jobs.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
    updated_at = now()
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.acquire_bling_sync_jobs(
  p_worker_id text,
  p_limit integer default 5,
  p_stale_after interval default interval '10 minutes'
)
returns setof public.bling_sync_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(p_worker_id, '')), '') is null then
    raise exception 'worker_id obrigatorio';
  end if;

  if coalesce(p_stale_after, interval '0 seconds') <= interval '0 seconds' then
    raise exception 'p_stale_after deve ser maior que zero';
  end if;

  update public.bling_sync_jobs
  set
    status = 'dead',
    locked_at = null,
    locked_by = null,
    last_error = case
      when nullif(last_error, '') is null then 'Tentativas maximas excedidas.'
      else last_error
    end,
    updated_at = now()
  where status = 'pending'
    and attempts >= max_attempts;

  update public.bling_sync_jobs
  set
    status = 'dead',
    locked_at = null,
    locked_by = null,
    last_error = case
      when nullif(last_error, '') is null then 'Job processing stale excedeu max_attempts.'
      else last_error
    end,
    updated_at = now()
  where status = 'processing'
    and locked_at <= now() - p_stale_after
    and attempts >= max_attempts;

  return query
  with candidates as (
    select id
    from public.bling_sync_jobs candidate
    where candidate.attempts < candidate.max_attempts
      and (
        (
          candidate.status = 'processing'
          and candidate.locked_at <= now() - p_stale_after
        )
        or (
          candidate.status = 'pending'
          and candidate.available_at <= now()
          and not exists (
            select 1
            from public.bling_sync_jobs running
            where running.entity_type = candidate.entity_type
              and running.entity_id = candidate.entity_id
              and running.operation = candidate.operation
              and running.status = 'processing'
          )
        )
      )
    order by priority asc, available_at asc, created_at asc
    limit greatest(1, least(coalesce(p_limit, 5), 20))
    for update skip locked
  )
  update public.bling_sync_jobs job
  set
    status = 'processing',
    attempts = attempts + 1,
    locked_at = now(),
    locked_by = p_worker_id,
    updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

create or replace function public.finish_bling_sync_job(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_last_error text default '',
  p_retry_after interval default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.bling_sync_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.bling_sync_jobs;
  v_successor public.bling_sync_jobs;
  v_retry_at timestamptz;
begin
  if p_status not in ('done', 'pending', 'error', 'dead', 'skipped') then
    raise exception 'status invalido';
  end if;

  select *
    into v_job
  from public.bling_sync_jobs
  where id = p_job_id
    and locked_by = p_worker_id
    and status = 'processing'
  for update;

  if v_job.id is null then
    raise exception 'job lock perdido';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', v_job.entity_type, v_job.entity_id::text, v_job.operation), 0)
  );

  if p_status = 'pending' and v_job.attempts >= v_job.max_attempts then
    update public.bling_sync_jobs
    set
      status = 'dead',
      locked_at = null,
      locked_by = null,
      last_error = left(coalesce(nullif(p_last_error, ''), 'Tentativas maximas excedidas.'), 1000),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
    where id = v_job.id
    returning * into v_job;

    return v_job;
  end if;

  if p_status = 'pending' then
    v_retry_at := now() + coalesce(p_retry_after, interval '5 minutes');

    select *
      into v_successor
    from public.bling_sync_jobs
    where entity_type = v_job.entity_type
      and entity_id = v_job.entity_id
      and operation = v_job.operation
      and status = 'pending'
      and id <> v_job.id
    for update;

    if v_successor.id is not null then
      update public.bling_sync_jobs
      set
        priority = least(priority, v_job.priority),
        available_at = least(available_at, v_retry_at),
        last_error = left(coalesce(nullif(p_last_error, ''), last_error), 1000),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'mergedRetryFromJobId', v_job.id,
            'mergedRetryAt', now(),
            'mergedRetryAttempts', v_job.attempts
          )
          || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
      where id = v_successor.id;

      update public.bling_sync_jobs
      set
        status = 'skipped',
        locked_at = null,
        locked_by = null,
        last_error = left(coalesce(nullif(p_last_error, ''), 'Retry incorporado ao pending sucessor.'), 1000),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'finishedAs', 'skipped',
            'mergedIntoPendingJobId', v_successor.id,
            'mergedAt', now()
          )
          || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
      where id = v_job.id
      returning * into v_job;

      return v_job;
    end if;
  end if;

  update public.bling_sync_jobs
  set
    status = p_status,
    available_at = case
      when p_status = 'pending' then now() + coalesce(p_retry_after, interval '5 minutes')
      else available_at
    end,
    locked_at = null,
    locked_by = null,
    last_error = left(coalesce(p_last_error, ''), 1000),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on table public.bling_sync_jobs from anon, authenticated;
revoke all on function public.enqueue_bling_sync_job(text, uuid, text, integer, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.acquire_bling_sync_jobs(text, integer, interval) from public, anon, authenticated;
revoke all on function public.finish_bling_sync_job(uuid, text, text, text, interval, jsonb) from public, anon, authenticated;

grant all on table public.bling_sync_jobs to service_role;
grant execute on function public.enqueue_bling_sync_job(text, uuid, text, integer, timestamptz, jsonb) to service_role;
grant execute on function public.acquire_bling_sync_jobs(text, integer, interval) to service_role;
grant execute on function public.finish_bling_sync_job(uuid, text, text, text, interval, jsonb) to service_role;

commit;
