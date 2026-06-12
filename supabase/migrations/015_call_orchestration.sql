-- Queue Orchestration V2 Phase 5: LiveKit call lifecycle + both-join timer support
-- Run after 014_available_soon_pool.sql

alter table public.speed_date_calls
  add column if not exists user_a_joined_at timestamptz,
  add column if not exists user_b_joined_at timestamptz,
  add column if not exists user_a_left_at timestamptz,
  add column if not exists user_b_left_at timestamptz,
  add column if not exists both_joined_at timestamptz,
  add column if not exists no_show_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists cancel_reason text
    check (cancel_reason is null or cancel_reason in ('no_show', 'user_cancel', 'block', 'partner_abandoned'));

comment on column public.speed_date_calls.both_joined_at is
  'When both participants joined the LiveKit room — client date timer starts from this moment.';
comment on column public.speed_date_calls.started_at is
  'First token issued or room activity; both_joined_at is the authoritative timer start.';

-- ---------------------------------------------------------------------------
-- Participant join / leave tracking (authenticated participants only)
-- ---------------------------------------------------------------------------

create or replace function public.mark_call_participant_joined(p_speed_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sd public.speed_dates%rowtype;
  v_call public.speed_date_calls%rowtype;
  v_is_user_a boolean;
  v_both_joined boolean;
  v_call_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sd
  from public.speed_dates
  where id = p_speed_date_id;

  if not found then
    raise exception 'Speed date not found';
  end if;

  if v_user_id not in (v_sd.user_a_id, v_sd.user_b_id) then
    raise exception 'Not a participant in this speed date';
  end if;

  if v_sd.status <> 'active' then
    raise exception 'Speed date is not active';
  end if;

  select * into v_call
  from public.speed_date_calls
  where speed_date_id = p_speed_date_id
  for update;

  if not found then
    raise exception 'Call session not found';
  end if;

  if v_call.status in ('completed', 'cancelled') then
    return jsonb_build_object(
      'ok', false,
      'error', 'Call has ended',
      'callStatus', v_call.status
    );
  end if;

  v_is_user_a := v_user_id = v_sd.user_a_id;

  update public.speed_date_calls
  set
    user_a_joined_at = case
      when v_is_user_a then coalesce(user_a_joined_at, now())
      else user_a_joined_at
    end,
    user_b_joined_at = case
      when not v_is_user_a then coalesce(user_b_joined_at, now())
      else user_b_joined_at
    end,
    user_a_left_at = case when v_is_user_a then null else user_a_left_at end,
    user_b_left_at = case when not v_is_user_a then null else user_b_left_at end
  where speed_date_id = p_speed_date_id
  returning * into v_call;

  v_both_joined :=
    v_call.user_a_joined_at is not null
    and v_call.user_b_joined_at is not null;

  if v_both_joined and v_call.both_joined_at is null then
    update public.speed_date_calls
    set
      status = 'active',
      both_joined_at = now(),
      started_at = coalesce(started_at, now())
    where speed_date_id = p_speed_date_id
    returning * into v_call;
  end if;

  v_call_status := v_call.status;

  return jsonb_build_object(
    'ok', true,
    'bothJoined', v_both_joined,
    'shouldStartTimer', v_both_joined,
    'callStatus', v_call_status,
    'bothJoinedAt', v_call.both_joined_at,
    'userAJoinedAt', v_call.user_a_joined_at,
    'userBJoinedAt', v_call.user_b_joined_at
  );
end;
$$;

create or replace function public.mark_call_participant_left(p_speed_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sd public.speed_dates%rowtype;
  v_call public.speed_date_calls%rowtype;
  v_is_user_a boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sd
  from public.speed_dates
  where id = p_speed_date_id;

  if not found then
    raise exception 'Speed date not found';
  end if;

  if v_user_id not in (v_sd.user_a_id, v_sd.user_b_id) then
    raise exception 'Not a participant in this speed date';
  end if;

  select * into v_call
  from public.speed_date_calls
  where speed_date_id = p_speed_date_id
  for update;

  if not found then
    raise exception 'Call session not found';
  end if;

  v_is_user_a := v_user_id = v_sd.user_a_id;

  update public.speed_date_calls
  set
    user_a_left_at = case
      when v_is_user_a then coalesce(user_a_left_at, now())
      else user_a_left_at
    end,
    user_b_left_at = case
      when not v_is_user_a then coalesce(user_b_left_at, now())
      else user_b_left_at
    end
  where speed_date_id = p_speed_date_id
  returning * into v_call;

  return jsonb_build_object(
    'ok', true,
    'callStatus', v_call.status,
    'bothJoined', v_call.both_joined_at is not null,
    'userAJoinedAt', v_call.user_a_joined_at,
    'userBJoinedAt', v_call.user_b_joined_at,
    'userALeftAt', v_call.user_a_left_at,
    'userBLeftAt', v_call.user_b_left_at
  );
end;
$$;

create or replace function public.cancel_call_no_show(p_speed_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sd public.speed_dates%rowtype;
  v_call public.speed_date_calls%rowtype;
  v_no_show_user_id uuid;
  v_joined_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sd
  from public.speed_dates
  where id = p_speed_date_id
  for update;

  if not found then
    raise exception 'Speed date not found';
  end if;

  if v_user_id not in (v_sd.user_a_id, v_sd.user_b_id) then
    raise exception 'Not a participant in this speed date';
  end if;

  select * into v_call
  from public.speed_date_calls
  where speed_date_id = p_speed_date_id
  for update;

  if not found then
    raise exception 'Call session not found';
  end if;

  if v_call.both_joined_at is not null then
    raise exception 'Call already started — cannot no-show cancel';
  end if;

  if v_call.status in ('completed', 'cancelled') then
    return jsonb_build_object('ok', true, 'alreadyEnded', true, 'callStatus', v_call.status);
  end if;

  if v_sd.user_a_id = v_user_id then
    v_joined_user_id := v_user_id;
    if v_call.user_a_joined_at is null then
      raise exception 'Caller has not joined the call';
    end if;
    if v_call.user_b_joined_at is not null then
      raise exception 'Partner already joined';
    end if;
    v_no_show_user_id := v_sd.user_b_id;
  else
    v_joined_user_id := v_user_id;
    if v_call.user_b_joined_at is null then
      raise exception 'Caller has not joined the call';
    end if;
    if v_call.user_a_joined_at is not null then
      raise exception 'Partner already joined';
    end if;
    v_no_show_user_id := v_sd.user_a_id;
  end if;

  update public.speed_date_calls
  set
    status = 'cancelled',
    cancel_reason = 'no_show',
    no_show_user_id = v_no_show_user_id,
    ended_at = coalesce(ended_at, now())
  where speed_date_id = p_speed_date_id;

  update public.speed_dates
  set status = 'cancelled', ended_at = now()
  where id = p_speed_date_id;

  update public.queue_entries
  set status = 'waiting', joined_at = now()
  where window_id = v_sd.window_id
    and user_id = v_joined_user_id
    and status = 'paired';

  update public.queue_entries
  set status = 'left'
  where window_id = v_sd.window_id
    and user_id = v_no_show_user_id
    and status = 'paired';

  return jsonb_build_object(
    'ok', true,
    'callStatus', 'cancelled',
    'cancelReason', 'no_show',
    'noShowUserId', v_no_show_user_id,
    'returnedToQueueUserId', v_joined_user_id
  );
end;
$$;

create or replace function public.complete_call_if_valid(p_speed_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sd public.speed_dates%rowtype;
  v_call public.speed_date_calls%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sd
  from public.speed_dates
  where id = p_speed_date_id;

  if not found then
    raise exception 'Speed date not found';
  end if;

  if v_user_id not in (v_sd.user_a_id, v_sd.user_b_id) then
    raise exception 'Not a participant in this speed date';
  end if;

  select * into v_call
  from public.speed_date_calls
  where speed_date_id = p_speed_date_id
  for update;

  if not found then
    raise exception 'Call session not found';
  end if;

  if v_call.status = 'completed' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'callStatus', 'completed');
  end if;

  if v_call.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'Call was cancelled', 'callStatus', 'cancelled');
  end if;

  if v_call.both_joined_at is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Call never started — both participants must join',
      'callStatus', v_call.status
    );
  end if;

  update public.speed_date_calls
  set
    status = 'completed',
    ended_at = coalesce(ended_at, now())
  where speed_date_id = p_speed_date_id;

  return jsonb_build_object(
    'ok', true,
    'callStatus', 'completed',
    'bothJoinedAt', v_call.both_joined_at
  );
end;
$$;

create or replace function public.get_call_orchestration_state(p_speed_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sd public.speed_dates%rowtype;
  v_call public.speed_date_calls%rowtype;
  v_both_joined boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sd
  from public.speed_dates
  where id = p_speed_date_id;

  if not found then
    raise exception 'Speed date not found';
  end if;

  if v_user_id not in (v_sd.user_a_id, v_sd.user_b_id) then
    raise exception 'Not a participant in this speed date';
  end if;

  select * into v_call
  from public.speed_date_calls
  where speed_date_id = p_speed_date_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Call session not found');
  end if;

  v_both_joined :=
    v_call.user_a_joined_at is not null
    and v_call.user_b_joined_at is not null;

  return jsonb_build_object(
    'ok', true,
    'callStatus', v_call.status,
    'cancelReason', v_call.cancel_reason,
    'bothJoined', coalesce(v_call.both_joined_at is not null, v_both_joined),
    'shouldStartTimer', v_call.both_joined_at is not null,
    'bothJoinedAt', v_call.both_joined_at,
    'userAJoinedAt', v_call.user_a_joined_at,
    'userBJoinedAt', v_call.user_b_joined_at,
    'userALeftAt', v_call.user_a_left_at,
    'userBLeftAt', v_call.user_b_left_at,
    'noShowUserId', v_call.no_show_user_id
  );
end;
$$;

-- Route legacy complete through validation when both joined
create or replace function public.complete_speed_date_call(p_speed_date_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.complete_call_if_valid(p_speed_date_id);
  if coalesce((v_result->>'ok')::boolean, false) is not true then
    raise exception '%', coalesce(v_result->>'error', 'Could not complete call');
  end if;
end;
$$;

revoke all on function public.mark_call_participant_joined(uuid) from public;
grant execute on function public.mark_call_participant_joined(uuid) to authenticated;

revoke all on function public.mark_call_participant_left(uuid) from public;
grant execute on function public.mark_call_participant_left(uuid) to authenticated;

revoke all on function public.cancel_call_no_show(uuid) from public;
grant execute on function public.cancel_call_no_show(uuid) to authenticated;

revoke all on function public.complete_call_if_valid(uuid) from public;
grant execute on function public.complete_call_if_valid(uuid) to authenticated;

revoke all on function public.get_call_orchestration_state(uuid) from public;
grant execute on function public.get_call_orchestration_state(uuid) to authenticated;
