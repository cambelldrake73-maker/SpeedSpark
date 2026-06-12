-- Queue Orchestration v2 Phase 1: pre-match reservations (plan early, commit late)
-- Run after 012_dating_intentions.sql
-- Note: filename is 013 because 011_contact_verification.sql already exists.

-- ---------------------------------------------------------------------------
-- pair_reservations
-- ---------------------------------------------------------------------------

create table public.pair_reservations (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.speed_date_windows (id) on delete cascade,
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'committed', 'expired', 'cancelled')),
  mutual_score numeric,
  plan_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  committed_at timestamptz,
  speed_date_id uuid references public.speed_dates (id) on delete set null,
  check (user_a_id <> user_b_id)
);

create index pair_reservations_window_status_idx
  on public.pair_reservations (window_id, status);

create index pair_reservations_user_a_status_idx
  on public.pair_reservations (user_a_id, status);

create index pair_reservations_user_b_status_idx
  on public.pair_reservations (user_b_id, status);

create index pair_reservations_expires_at_idx
  on public.pair_reservations (expires_at)
  where status = 'pending';

-- At most one pending reservation per user per window (either column).
create unique index pair_reservations_pending_user_a_window_idx
  on public.pair_reservations (window_id, user_a_id)
  where status = 'pending';

create unique index pair_reservations_pending_user_b_window_idx
  on public.pair_reservations (window_id, user_b_id)
  where status = 'pending';

alter table public.pair_reservations enable row level security;

-- Service role only — clients never read/write reservations directly in Phase 1.
create policy "Service role manages pair reservations"
on public.pair_reservations for all to service_role
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- Expire stale pending reservations
-- ---------------------------------------------------------------------------

create or replace function public.expire_pair_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.pair_reservations
  set status = 'expired'
  where status = 'pending'
    and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_pair_reservations() from public;
grant execute on function public.expire_pair_reservations() to service_role;

-- ---------------------------------------------------------------------------
-- Cancel a pending reservation
-- ---------------------------------------------------------------------------

create or replace function public.cancel_pair_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pair_reservations%rowtype;
begin
  select * into v_row
  from public.pair_reservations
  where id = p_reservation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Reservation not found');
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'error', format('Reservation is not pending (status=%s)', v_row.status)
    );
  end if;

  update public.pair_reservations
  set status = 'cancelled'
  where id = p_reservation_id;

  return jsonb_build_object('ok', true, 'reservation_id', p_reservation_id);
end;
$$;

revoke all on function public.cancel_pair_reservation(uuid) from public;
grant execute on function public.cancel_pair_reservation(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Commit reservation → speed_date + queue paired
-- ---------------------------------------------------------------------------

create or replace function public.commit_pair_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pair_reservations%rowtype;
  v_speed_date_id uuid;
begin
  perform public.expire_pair_reservations();

  select * into v_row
  from public.pair_reservations
  where id = p_reservation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Reservation not found');
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'error', format('Reservation is not pending (status=%s)', v_row.status)
    );
  end if;

  if v_row.expires_at < now() then
    update public.pair_reservations set status = 'expired' where id = p_reservation_id;
    return jsonb_build_object('ok', false, 'error', 'Reservation expired');
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id in (v_row.user_a_id, v_row.user_b_id)
      and p.account_status <> 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Inactive account');
  end if;

  if exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = v_row.user_a_id and b.blocked_id = v_row.user_b_id)
       or (b.blocker_id = v_row.user_b_id and b.blocked_id = v_row.user_a_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'Blocked relationship');
  end if;

  if exists (
    select 1 from public.reports r
    where (r.reporter_id = v_row.user_a_id and r.reported_id = v_row.user_b_id)
       or (r.reporter_id = v_row.user_b_id and r.reported_id = v_row.user_a_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'Reported relationship');
  end if;

  if not exists (
    select 1 from public.queue_entries q
    where q.window_id = v_row.window_id
      and q.user_id = v_row.user_a_id
      and q.status = 'waiting'
  ) then
    return jsonb_build_object('ok', false, 'error', 'User A is not waiting in this window');
  end if;

  if not exists (
    select 1 from public.queue_entries q
    where q.window_id = v_row.window_id
      and q.user_id = v_row.user_b_id
      and q.status = 'waiting'
  ) then
    return jsonb_build_object('ok', false, 'error', 'User B is not waiting in this window');
  end if;

  if exists (
    select 1 from public.speed_dates sd
    where sd.status = 'active'
      and v_row.user_a_id in (sd.user_a_id, sd.user_b_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'User A has an active speed date');
  end if;

  if exists (
    select 1 from public.speed_dates sd
    where sd.status = 'active'
      and v_row.user_b_id in (sd.user_a_id, sd.user_b_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'User B has an active speed date');
  end if;

  insert into public.speed_dates (window_id, user_a_id, user_b_id, status)
  values (v_row.window_id, v_row.user_a_id, v_row.user_b_id, 'active')
  returning id into v_speed_date_id;

  update public.queue_entries
  set status = 'paired'
  where window_id = v_row.window_id
    and user_id in (v_row.user_a_id, v_row.user_b_id)
    and status = 'waiting';

  update public.pair_reservations
  set
    status = 'committed',
    committed_at = now(),
    speed_date_id = v_speed_date_id
  where id = p_reservation_id;

  return jsonb_build_object(
    'ok', true,
    'reservation_id', p_reservation_id,
    'speed_date_id', v_speed_date_id,
    'window_id', v_row.window_id,
    'user_a_id', v_row.user_a_id,
    'user_b_id', v_row.user_b_id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

revoke all on function public.commit_pair_reservation(uuid) from public;
grant execute on function public.commit_pair_reservation(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Create reservation (service pairing planner)
-- ---------------------------------------------------------------------------

create or replace function public.create_pair_reservation(
  p_window_id uuid,
  p_user_a_id uuid,
  p_user_b_id uuid,
  p_mutual_score numeric default null,
  p_plan_snapshot jsonb default '{}'::jsonb,
  p_ttl_seconds integer default 90
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ttl integer := greatest(coalesce(p_ttl_seconds, 90), 30);
begin
  if p_user_a_id = p_user_b_id then
    raise exception 'Cannot reserve a user with themselves';
  end if;

  perform public.expire_pair_reservations();

  if exists (
    select 1 from public.pair_reservations r
    where r.window_id = p_window_id
      and r.status = 'pending'
      and (
        r.user_a_id in (p_user_a_id, p_user_b_id)
        or r.user_b_id in (p_user_a_id, p_user_b_id)
      )
  ) then
    raise exception 'One or both users already have a pending reservation in this window';
  end if;

  insert into public.pair_reservations (
    window_id,
    user_a_id,
    user_b_id,
    status,
    mutual_score,
    plan_snapshot,
    expires_at
  )
  values (
    p_window_id,
    p_user_a_id,
    p_user_b_id,
    'pending',
    p_mutual_score,
    coalesce(p_plan_snapshot, '{}'::jsonb),
    now() + make_interval(secs => v_ttl)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_pair_reservation(uuid, uuid, uuid, numeric, jsonb, integer) from public;
grant execute on function public.create_pair_reservation(uuid, uuid, uuid, numeric, jsonb, integer) to service_role;
