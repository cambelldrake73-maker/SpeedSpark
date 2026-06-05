-- Automatic pairing coordinator: locks + run logs + lock RPCs
-- Run after 005_matching_priority_order.sql

-- ---------------------------------------------------------------------------
-- Pairing run audit log
-- ---------------------------------------------------------------------------

create table public.pairing_run_logs (
  id uuid primary key default gen_random_uuid(),
  window_id uuid references public.speed_date_windows (id) on delete set null,
  trigger_source text not null check (trigger_source in ('client_worker', 'edge_function', 'dev_console')),
  candidates_considered integer not null default 0 check (candidates_considered >= 0),
  pairs_created integer not null default 0 check (pairs_created >= 0),
  unmatched_count integer not null default 0 check (unmatched_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index pairing_run_logs_window_created_idx
  on public.pairing_run_logs (window_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Per-window distributed lock (prevents concurrent pairing runs)
-- ---------------------------------------------------------------------------

create table public.pairing_window_locks (
  window_id uuid primary key references public.speed_date_windows (id) on delete cascade,
  locked_by text not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create index pairing_window_locks_locked_until_idx
  on public.pairing_window_locks (locked_until);

-- ---------------------------------------------------------------------------
-- Lock RPCs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.try_acquire_pairing_lock(
  p_window_id uuid,
  p_worker_id text,
  p_ttl_seconds integer default 25
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_until timestamptz := v_now + make_interval(secs => greatest(p_ttl_seconds, 5));
  v_acquired boolean := false;
begin
  delete from public.pairing_window_locks
  where locked_until < v_now;

  insert into public.pairing_window_locks (window_id, locked_by, locked_until)
  values (p_window_id, p_worker_id, v_until)
  on conflict (window_id) do update
    set locked_by = excluded.locked_by,
        locked_until = excluded.locked_until,
        updated_at = v_now
    where public.pairing_window_locks.locked_until < v_now
       or public.pairing_window_locks.locked_by = excluded.locked_by;

  select exists (
    select 1
    from public.pairing_window_locks l
    where l.window_id = p_window_id
      and l.locked_by = p_worker_id
      and l.locked_until >= v_now
  )
  into v_acquired;

  return v_acquired;
end;
$$;

create or replace function public.release_pairing_lock(
  p_window_id uuid,
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.pairing_window_locks
  where window_id = p_window_id
    and locked_by = p_worker_id;
end;
$$;

revoke all on function public.try_acquire_pairing_lock(uuid, text, integer) from public;
grant execute on function public.try_acquire_pairing_lock(uuid, text, integer) to authenticated, service_role;

revoke all on function public.release_pairing_lock(uuid, text) from public;
grant execute on function public.release_pairing_lock(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pairing_run_logs enable row level security;
alter table public.pairing_window_locks enable row level security;

create policy "Authenticated insert pairing run logs"
on public.pairing_run_logs for insert to authenticated
with check (true);

create policy "Authenticated read pairing run logs"
on public.pairing_run_logs for select to authenticated
using (true);

create policy "Service role manages pairing run logs"
on public.pairing_run_logs for all to service_role
using (true)
with check (true);

create policy "Service role manages pairing locks"
on public.pairing_window_locks for all to service_role
using (true)
with check (true);

-- Locks are only mutated via SECURITY DEFINER RPCs; no direct client access.
