-- LiveKit call sessions for speed dates (Phase 1: voice)
-- Run after 009_account_safety.sql

create table public.speed_date_calls (
  id uuid primary key default gen_random_uuid(),
  speed_date_id uuid not null unique references public.speed_dates (id) on delete cascade,
  room_name text not null unique,
  provider text not null default 'livekit',
  provider_room_id text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists speed_date_calls_status_idx on public.speed_date_calls (status);
create index if not exists speed_date_calls_speed_date_id_idx on public.speed_date_calls (speed_date_id);

alter table public.speed_date_calls enable row level security;

-- Participants may read their call row
create policy "Speed date participants read call"
on public.speed_date_calls for select to authenticated
using (
  exists (
    select 1 from public.speed_dates sd
    where sd.id = speed_date_calls.speed_date_id
      and auth.uid() in (sd.user_a_id, sd.user_b_id)
  )
);

-- Service role manages call rows (Edge Functions)
create policy "Service role manages speed date calls"
on public.speed_date_calls for all to service_role
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- Participant-safe call status updates
-- ---------------------------------------------------------------------------

create or replace function public.complete_speed_date_call(p_speed_date_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.speed_dates sd
    where sd.id = p_speed_date_id
      and v_user_id in (sd.user_a_id, sd.user_b_id)
  ) then
    raise exception 'Not a participant in this speed date';
  end if;

  update public.speed_date_calls
  set
    status = 'completed',
    ended_at = coalesce(ended_at, now())
  where speed_date_id = p_speed_date_id
    and status in ('pending', 'active');
end;
$$;

create or replace function public.cancel_speed_date_call(p_speed_date_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.speed_dates sd
    where sd.id = p_speed_date_id
      and v_user_id in (sd.user_a_id, sd.user_b_id)
  ) then
    raise exception 'Not a participant in this speed date';
  end if;

  update public.speed_date_calls
  set
    status = 'cancelled',
    ended_at = coalesce(ended_at, now())
  where speed_date_id = p_speed_date_id
    and status in ('pending', 'active');
end;
$$;

revoke all on function public.complete_speed_date_call(uuid) from public;
grant execute on function public.complete_speed_date_call(uuid) to authenticated;

revoke all on function public.cancel_speed_date_call(uuid) from public;
grant execute on function public.cancel_speed_date_call(uuid) to authenticated;
