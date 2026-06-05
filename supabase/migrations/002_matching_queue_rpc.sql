-- Queue pairing RPC (SECURITY DEFINER — updates both users' queue rows + creates speed_date)
-- Run after 001_initial_schema.sql

create or replace function public.apply_queue_pair(
  p_window_id uuid,
  p_user_a_id uuid,
  p_user_b_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_speed_date_id uuid;
begin
  if p_user_a_id = p_user_b_id then
    raise exception 'Cannot pair a user with themselves';
  end if;

  if exists (
    select 1
    from public.blocked_users b
    where (b.blocker_id = p_user_a_id and b.blocked_id = p_user_b_id)
       or (b.blocker_id = p_user_b_id and b.blocked_id = p_user_a_id)
  ) then
    raise exception 'Cannot pair blocked users';
  end if;

  if not exists (
    select 1 from public.queue_entries q
    where q.window_id = p_window_id
      and q.user_id = p_user_a_id
      and q.status = 'waiting'
  ) then
    raise exception 'User A is not waiting in this window';
  end if;

  if not exists (
    select 1 from public.queue_entries q
    where q.window_id = p_window_id
      and q.user_id = p_user_b_id
      and q.status = 'waiting'
  ) then
    raise exception 'User B is not waiting in this window';
  end if;

  insert into public.speed_dates (window_id, user_a_id, user_b_id, status)
  values (p_window_id, p_user_a_id, p_user_b_id, 'active')
  returning id into v_speed_date_id;

  update public.queue_entries
  set status = 'paired'
  where window_id = p_window_id
    and user_id in (p_user_a_id, p_user_b_id)
    and status = 'waiting';

  return v_speed_date_id;
end;
$$;

revoke all on function public.apply_queue_pair(uuid, uuid, uuid) from public;
grant execute on function public.apply_queue_pair(uuid, uuid, uuid) to authenticated;

-- Allow participants to read speed dates they are in (already exists) and update own-ended dates
create policy "Participants update own speed dates"
on public.speed_dates for update to authenticated
using (auth.uid() in (user_a_id, user_b_id))
with check (auth.uid() in (user_a_id, user_b_id));
