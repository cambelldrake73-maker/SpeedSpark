-- Post-date feedback + mutual match resolution (SECURITY DEFINER)
-- Run after 002_matching_queue_rpc.sql

create or replace function public.get_speed_date_match_result(p_speed_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_a_id uuid;
  v_user_b_id uuid;
  v_partner_id uuid;
  v_my_feedback record;
  v_partner_feedback record;
  v_match_id uuid;
  v_blocked boolean;
  v_reported boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select sd.user_a_id, sd.user_b_id
  into v_user_a_id, v_user_b_id
  from public.speed_dates sd
  where sd.id = p_speed_date_id;

  if not found then
    raise exception 'Speed date not found';
  end if;

  if v_user_id not in (v_user_a_id, v_user_b_id) then
    raise exception 'Not a participant in this speed date';
  end if;

  if v_user_id = v_user_a_id then
    v_partner_id := v_user_b_id;
  else
    v_partner_id := v_user_a_id;
  end if;

  select df.would_talk_again, df.attractiveness_rating
  into v_my_feedback
  from public.date_feedback df
  where df.speed_date_id = p_speed_date_id
    and df.rater_id = v_user_id;

  select df.would_talk_again
  into v_partner_feedback
  from public.date_feedback df
  where df.speed_date_id = p_speed_date_id
    and df.rater_id = v_partner_id;

  select exists (
    select 1
    from public.blocked_users b
    where (b.blocker_id = v_user_id and b.blocked_id = v_partner_id)
       or (b.blocker_id = v_partner_id and b.blocked_id = v_user_id)
  ) into v_blocked;

  select exists (
    select 1
    from public.reports r
    where r.speed_date_id = p_speed_date_id
      and (
        (r.reporter_id = v_user_id and r.reported_id = v_partner_id)
        or (r.reporter_id = v_partner_id and r.reported_id = v_user_id)
      )
  ) into v_reported;

  select m.id
  into v_match_id
  from public.matches m
  where least(m.user_a_id, m.user_b_id) = least(v_user_id, v_partner_id)
    and greatest(m.user_a_id, m.user_b_id) = greatest(v_user_id, v_partner_id);

  if v_my_feedback is null then
    return jsonb_build_object(
      'status', 'pending_self',
      'myFeedbackSubmitted', false,
      'myWouldTalkAgain', null,
      'partnerFeedbackSubmitted', v_partner_feedback is not null,
      'partnerWouldTalkAgain', case when v_partner_feedback is null then null else v_partner_feedback.would_talk_again end,
      'isMutualMatch', false,
      'matchId', v_match_id,
      'blocked', v_blocked,
      'reported', v_reported
    );
  end if;

  if v_partner_feedback is null then
    return jsonb_build_object(
      'status', 'waiting',
      'myFeedbackSubmitted', true,
      'myWouldTalkAgain', v_my_feedback.would_talk_again,
      'partnerFeedbackSubmitted', false,
      'partnerWouldTalkAgain', null,
      'isMutualMatch', false,
      'matchId', v_match_id,
      'blocked', v_blocked,
      'reported', v_reported
    );
  end if;

  if v_blocked or v_reported
     or not v_my_feedback.would_talk_again
     or not v_partner_feedback.would_talk_again then
    return jsonb_build_object(
      'status', 'no_match',
      'myFeedbackSubmitted', true,
      'myWouldTalkAgain', v_my_feedback.would_talk_again,
      'partnerFeedbackSubmitted', true,
      'partnerWouldTalkAgain', v_partner_feedback.would_talk_again,
      'isMutualMatch', false,
      'matchId', v_match_id,
      'blocked', v_blocked,
      'reported', v_reported
    );
  end if;

  if v_match_id is null then
    insert into public.matches (user_a_id, user_b_id, speed_date_id)
    values (v_user_a_id, v_user_b_id, p_speed_date_id)
    on conflict do nothing
    returning id into v_match_id;

    if v_match_id is null then
      select m.id
      into v_match_id
      from public.matches m
      where least(m.user_a_id, m.user_b_id) = least(v_user_id, v_partner_id)
        and greatest(m.user_a_id, m.user_b_id) = greatest(v_user_id, v_partner_id);
    end if;
  end if;

  return jsonb_build_object(
    'status', 'mutual_match',
    'myFeedbackSubmitted', true,
    'myWouldTalkAgain', true,
    'partnerFeedbackSubmitted', true,
    'partnerWouldTalkAgain', true,
    'isMutualMatch', true,
    'matchId', v_match_id,
    'blocked', v_blocked,
    'reported', v_reported
  );
end;
$$;

create or replace function public.submit_date_feedback_and_resolve(
  p_speed_date_id uuid,
  p_partner_id uuid,
  p_attractiveness_rating integer,
  p_would_talk_again boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_a_id uuid;
  v_user_b_id uuid;
  v_expected_partner uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_attractiveness_rating < 1 or p_attractiveness_rating > 10 then
    raise exception 'Attractiveness rating must be between 1 and 10';
  end if;

  select sd.user_a_id, sd.user_b_id
  into v_user_a_id, v_user_b_id
  from public.speed_dates sd
  where sd.id = p_speed_date_id;

  if not found then
    raise exception 'Speed date not found';
  end if;

  if v_user_id not in (v_user_a_id, v_user_b_id) then
    raise exception 'Not a participant in this speed date';
  end if;

  v_expected_partner := case
    when v_user_id = v_user_a_id then v_user_b_id
    else v_user_a_id
  end;

  if p_partner_id <> v_expected_partner then
    raise exception 'Invalid partner for this speed date';
  end if;

  insert into public.date_feedback (
    speed_date_id,
    rater_id,
    partner_id,
    attractiveness_rating,
    would_talk_again
  )
  values (
    p_speed_date_id,
    v_user_id,
    p_partner_id,
    p_attractiveness_rating,
    p_would_talk_again
  )
  on conflict (speed_date_id, rater_id) do update set
    attractiveness_rating = excluded.attractiveness_rating,
    would_talk_again = excluded.would_talk_again;

  return public.get_speed_date_match_result(p_speed_date_id);
end;
$$;

revoke all on function public.get_speed_date_match_result(uuid) from public;
grant execute on function public.get_speed_date_match_result(uuid) to authenticated;

revoke all on function public.submit_date_feedback_and_resolve(uuid, uuid, integer, boolean) from public;
grant execute on function public.submit_date_feedback_and_resolve(uuid, uuid, integer, boolean) to authenticated;
