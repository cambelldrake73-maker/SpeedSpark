-- Queue Orchestration v2 Phase 2: Available Soon candidate pool
-- Run after 013_pair_reservations.sql

-- ---------------------------------------------------------------------------
-- Server-side speed date duration (production default: 300s)
-- Dev helpers backdate started_at to simulate ending-soon windows.
-- ---------------------------------------------------------------------------

create or replace function public.speed_date_duration_seconds()
returns integer
language sql
immutable
as $$
  select 300;
$$;

create or replace function public.available_soon_threshold_seconds()
returns integer
language sql
immutable
as $$
  select 60;
$$;

-- ---------------------------------------------------------------------------
-- Extend matching context: waiting + available_soon candidates
-- ---------------------------------------------------------------------------

create or replace function public.get_window_matching_context(p_window_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer := public.speed_date_duration_seconds();
  v_threshold integer := public.available_soon_threshold_seconds();
  v_waiting_user_ids uuid[];
  v_available_soon_user_ids uuid[];
  v_all_user_ids uuid[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden: server pairing context only';
  end if;

  select array_agg(q.user_id order by q.joined_at)
  into v_waiting_user_ids
  from public.queue_entries q
  inner join public.profiles p on p.id = q.user_id
  where q.window_id = p_window_id
    and q.status = 'waiting'
    and p.account_status = 'active';

  select array_agg(distinct soon.user_id order by soon.user_id)
  into v_available_soon_user_ids
  from (
    select
      sd.user_a_id as user_id,
      sd.id as speed_date_id,
      sd.user_b_id as current_partner_id,
      sd.started_at,
      greatest(
        0,
        v_duration - floor(extract(epoch from (now() - sd.started_at)))::integer
      ) as seconds_until_available
    from public.speed_dates sd
    inner join public.profiles p on p.id = sd.user_a_id
    where sd.window_id = p_window_id
      and sd.status = 'active'
      and p.account_status = 'active'
      and v_duration - extract(epoch from (now() - sd.started_at)) <= v_threshold
      and v_duration - extract(epoch from (now() - sd.started_at)) > 0
      and not exists (
        select 1 from public.blocked_users b
        where (b.blocker_id = sd.user_a_id and b.blocked_id = sd.user_b_id)
           or (b.blocker_id = sd.user_b_id and b.blocked_id = sd.user_a_id)
      )
      and not exists (
        select 1 from public.reports r
        where (r.reporter_id = sd.user_a_id and r.reported_id = sd.user_b_id)
           or (r.reporter_id = sd.user_b_id and r.reported_id = sd.user_a_id)
      )
      and not exists (
        select 1 from public.pair_reservations rsv
        where rsv.window_id = p_window_id
          and rsv.status = 'pending'
          and sd.user_a_id in (rsv.user_a_id, rsv.user_b_id)
      )
      and not exists (
        select 1 from public.speed_dates sd2
        where sd2.status = 'active'
          and sd2.id <> sd.id
          and sd.user_a_id in (sd2.user_a_id, sd2.user_b_id)
      )
    union all
    select
      sd.user_b_id,
      sd.id,
      sd.user_a_id,
      sd.started_at,
      greatest(
        0,
        v_duration - floor(extract(epoch from (now() - sd.started_at)))::integer
      )
    from public.speed_dates sd
    inner join public.profiles p on p.id = sd.user_b_id
    where sd.window_id = p_window_id
      and sd.status = 'active'
      and p.account_status = 'active'
      and v_duration - extract(epoch from (now() - sd.started_at)) <= v_threshold
      and v_duration - extract(epoch from (now() - sd.started_at)) > 0
      and not exists (
        select 1 from public.blocked_users b
        where (b.blocker_id = sd.user_a_id and b.blocked_id = sd.user_b_id)
           or (b.blocker_id = sd.user_b_id and b.blocked_id = sd.user_a_id)
      )
      and not exists (
        select 1 from public.reports r
        where (r.reporter_id = sd.user_a_id and r.reported_id = sd.user_b_id)
           or (r.reporter_id = sd.user_b_id and r.reported_id = sd.user_a_id)
      )
      and not exists (
        select 1 from public.pair_reservations rsv
        where rsv.window_id = p_window_id
          and rsv.status = 'pending'
          and sd.user_b_id in (rsv.user_a_id, rsv.user_b_id)
      )
      and not exists (
        select 1 from public.speed_dates sd2
        where sd2.status = 'active'
          and sd2.id <> sd.id
          and sd.user_b_id in (sd2.user_a_id, sd2.user_b_id)
      )
  ) soon
  where not exists (
    select 1 from public.queue_entries q
    where q.window_id = p_window_id
      and q.user_id = soon.user_id
      and q.status = 'waiting'
  );

  v_all_user_ids := (
    select array_agg(distinct uid)
    from unnest(coalesce(v_waiting_user_ids, '{}'::uuid[]) || coalesce(v_available_soon_user_ids, '{}'::uuid[])) as uid
  );

  if v_all_user_ids is null then
    return jsonb_build_object(
      'windowId', p_window_id,
      'entries', '[]'::jsonb,
      'blockedEdges', '[]'::jsonb,
      'reportedPairKeys', '[]'::jsonb,
      'recentPairKeys', '[]'::jsonb,
      'appearanceScores', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'windowId', p_window_id,
    'entries', (
      select coalesce(jsonb_agg(entry order by entry->>'joinedAt'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'queueEntryId', q.id,
          'userId', q.user_id,
          'joinedAt', q.joined_at,
          'availability', 'waiting',
          'speedDateId', null,
          'secondsUntilAvailable', 0,
          'currentPartnerId', null,
          'profile', jsonb_build_object(
            'id', p.id,
            'name', trim(both ' ' from coalesce(nullif(p.display_name, ''), p.first_name || ' ' || p.last_name)),
            'age', p.age,
            'location', p.location_label,
            'locationLatitude', p.location_latitude,
            'locationLongitude', p.location_longitude,
            'heightInches', p.height_inches,
            'photos', '[]'::jsonb,
            'genderIdentity', p.gender_identity,
            'sexualOrientation', p.sexual_orientation,
            'interestedInGenders', to_jsonb(p.looking_for),
            'datingIntentions', to_jsonb(p.dating_intentions),
            'queerRoles', to_jsonb(p.queer_roles),
            'presentationTags', to_jsonb(p.presentation_tags),
            'personalityTags', to_jsonb(p.personality_tags),
            'lifestyleTags', to_jsonb(p.lifestyle_tags),
            'verificationStatus', p.verification_status,
            'accountStatus', p.account_status
          ),
          'preferences', jsonb_build_object(
            'ageRangeMin', dp.age_range_min,
            'ageRangeMax', dp.age_range_max,
            'heightMinInches', dp.height_min_inches,
            'heightMaxInches', dp.height_max_inches,
            'maxDistanceMiles', dp.max_distance_miles,
            'preferredOrientations', to_jsonb(dp.preferred_orientations),
            'preferredLookingFor', to_jsonb(dp.preferred_looking_for),
            'preferredQueerRoles', to_jsonb(dp.preferred_queer_roles),
            'preferredPresentationTags', to_jsonb(dp.preferred_presentation_tags),
            'dealbreakers', to_jsonb(dp.dealbreakers),
            'niceToHaves', to_jsonb(dp.nice_to_haves),
            'matchingPriorityOrder', to_jsonb(dp.matching_priority_order)
          )
        ) as entry
        from public.queue_entries q
        inner join public.profiles p on p.id = q.user_id
        inner join public.dating_preferences dp on dp.user_id = q.user_id
        where q.window_id = p_window_id
          and q.status = 'waiting'
          and p.account_status = 'active'
        union all
        select jsonb_build_object(
          'queueEntryId', q.id,
          'userId', soon.user_id,
          'joinedAt', coalesce(q.joined_at, soon.started_at),
          'availability', 'available_soon',
          'speedDateId', soon.speed_date_id,
          'secondsUntilAvailable', soon.seconds_until_available,
          'currentPartnerId', soon.current_partner_id,
          'profile', jsonb_build_object(
            'id', p.id,
            'name', trim(both ' ' from coalesce(nullif(p.display_name, ''), p.first_name || ' ' || p.last_name)),
            'age', p.age,
            'location', p.location_label,
            'locationLatitude', p.location_latitude,
            'locationLongitude', p.location_longitude,
            'heightInches', p.height_inches,
            'photos', '[]'::jsonb,
            'genderIdentity', p.gender_identity,
            'sexualOrientation', p.sexual_orientation,
            'interestedInGenders', to_jsonb(p.looking_for),
            'datingIntentions', to_jsonb(p.dating_intentions),
            'queerRoles', to_jsonb(p.queer_roles),
            'presentationTags', to_jsonb(p.presentation_tags),
            'personalityTags', to_jsonb(p.personality_tags),
            'lifestyleTags', to_jsonb(p.lifestyle_tags),
            'verificationStatus', p.verification_status,
            'accountStatus', p.account_status
          ),
          'preferences', jsonb_build_object(
            'ageRangeMin', dp.age_range_min,
            'ageRangeMax', dp.age_range_max,
            'heightMinInches', dp.height_min_inches,
            'heightMaxInches', dp.height_max_inches,
            'maxDistanceMiles', dp.max_distance_miles,
            'preferredOrientations', to_jsonb(dp.preferred_orientations),
            'preferredLookingFor', to_jsonb(dp.preferred_looking_for),
            'preferredQueerRoles', to_jsonb(dp.preferred_queer_roles),
            'preferredPresentationTags', to_jsonb(dp.preferred_presentation_tags),
            'dealbreakers', to_jsonb(dp.dealbreakers),
            'niceToHaves', to_jsonb(dp.nice_to_haves),
            'matchingPriorityOrder', to_jsonb(dp.matching_priority_order)
          )
        )
        from (
          select
            sd.user_a_id as user_id,
            sd.id as speed_date_id,
            sd.user_b_id as current_partner_id,
            sd.started_at,
            greatest(
              0,
              v_duration - floor(extract(epoch from (now() - sd.started_at)))::integer
            ) as seconds_until_available
          from public.speed_dates sd
          inner join public.profiles p on p.id = sd.user_a_id
          where sd.window_id = p_window_id
            and sd.status = 'active'
            and p.account_status = 'active'
            and v_duration - extract(epoch from (now() - sd.started_at)) <= v_threshold
            and v_duration - extract(epoch from (now() - sd.started_at)) > 0
            and not exists (
              select 1 from public.blocked_users b
              where (b.blocker_id = sd.user_a_id and b.blocked_id = sd.user_b_id)
                 or (b.blocker_id = sd.user_b_id and b.blocked_id = sd.user_a_id)
            )
            and not exists (
              select 1 from public.reports r
              where (r.reporter_id = sd.user_a_id and r.reported_id = sd.user_b_id)
                 or (r.reporter_id = sd.user_b_id and r.reported_id = sd.user_a_id)
            )
            and not exists (
              select 1 from public.pair_reservations rsv
              where rsv.window_id = p_window_id
                and rsv.status = 'pending'
                and sd.user_a_id in (rsv.user_a_id, rsv.user_b_id)
            )
            and not exists (
              select 1 from public.speed_dates sd2
              where sd2.status = 'active'
                and sd2.id <> sd.id
                and sd.user_a_id in (sd2.user_a_id, sd2.user_b_id)
            )
          union all
          select
            sd.user_b_id,
            sd.id,
            sd.user_a_id,
            sd.started_at,
            greatest(
              0,
              v_duration - floor(extract(epoch from (now() - sd.started_at)))::integer
            )
          from public.speed_dates sd
          inner join public.profiles p on p.id = sd.user_b_id
          where sd.window_id = p_window_id
            and sd.status = 'active'
            and p.account_status = 'active'
            and v_duration - extract(epoch from (now() - sd.started_at)) <= v_threshold
            and v_duration - extract(epoch from (now() - sd.started_at)) > 0
            and not exists (
              select 1 from public.blocked_users b
              where (b.blocker_id = sd.user_a_id and b.blocked_id = sd.user_b_id)
                 or (b.blocker_id = sd.user_b_id and b.blocked_id = sd.user_a_id)
            )
            and not exists (
              select 1 from public.reports r
              where (r.reporter_id = sd.user_a_id and r.reported_id = sd.user_b_id)
                 or (r.reporter_id = sd.user_b_id and r.reported_id = sd.user_a_id)
            )
            and not exists (
              select 1 from public.pair_reservations rsv
              where rsv.window_id = p_window_id
                and rsv.status = 'pending'
                and sd.user_b_id in (rsv.user_a_id, rsv.user_b_id)
            )
            and not exists (
              select 1 from public.speed_dates sd2
              where sd2.status = 'active'
                and sd2.id <> sd.id
                and sd.user_b_id in (sd2.user_a_id, sd2.user_b_id)
            )
        ) soon
        inner join public.profiles p on p.id = soon.user_id
        inner join public.dating_preferences dp on dp.user_id = soon.user_id
        left join public.queue_entries q
          on q.window_id = p_window_id
         and q.user_id = soon.user_id
        where not exists (
          select 1 from public.queue_entries qw
          where qw.window_id = p_window_id
            and qw.user_id = soon.user_id
            and qw.status = 'waiting'
        )
      ) combined
    ),
    'blockedEdges', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'blockerId', b.blocker_id,
        'blockedId', b.blocked_id
      )), '[]'::jsonb)
      from public.blocked_users b
      where b.blocker_id = any (v_all_user_ids)
        and b.blocked_id = any (v_all_user_ids)
    ),
    'reportedPairKeys', (
      select coalesce(jsonb_agg(
        least(r.reporter_id::text, r.reported_id::text) || ':' ||
        greatest(r.reporter_id::text, r.reported_id::text)
      ), '[]'::jsonb)
      from public.reports r
      where r.reporter_id = any (v_all_user_ids)
        and r.reported_id = any (v_all_user_ids)
    ),
    'recentPairKeys', (
      select coalesce(jsonb_agg(distinct
        least(sd.user_a_id::text, sd.user_b_id::text) || ':' ||
        greatest(sd.user_a_id::text, sd.user_b_id::text)
      ), '[]'::jsonb)
      from public.speed_dates sd
      where sd.started_at >= now() - interval '14 days'
        and sd.user_a_id = any (v_all_user_ids)
        and sd.user_b_id = any (v_all_user_ids)
    ),
    'appearanceScores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'viewerId', df.rater_id,
        'partnerId', df.partner_id,
        'score', greatest(0, least(100, df.attractiveness_rating * 10))
      )), '[]'::jsonb)
      from public.date_feedback df
      where df.rater_id = any (v_all_user_ids)
        and df.partner_id = any (v_all_user_ids)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Commit reservation — clearer still-active errors (Phase 2)
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
    return jsonb_build_object('ok', false, 'error', 'Reservation not found', 'reason_code', 'not_found');
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'error', format('Reservation is not pending (status=%s)', v_row.status),
      'reason_code', 'not_pending'
    );
  end if;

  if v_row.expires_at < now() then
    update public.pair_reservations set status = 'expired' where id = p_reservation_id;
    return jsonb_build_object('ok', false, 'error', 'Reservation expired', 'reason_code', 'expired');
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id in (v_row.user_a_id, v_row.user_b_id)
      and p.account_status <> 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Inactive account', 'reason_code', 'inactive_account');
  end if;

  if exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = v_row.user_a_id and b.blocked_id = v_row.user_b_id)
       or (b.blocker_id = v_row.user_b_id and b.blocked_id = v_row.user_a_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'Blocked relationship', 'reason_code', 'blocked');
  end if;

  if exists (
    select 1 from public.reports r
    where (r.reporter_id = v_row.user_a_id and r.reported_id = v_row.user_b_id)
       or (r.reporter_id = v_row.user_b_id and r.reported_id = v_row.user_a_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'Reported relationship', 'reason_code', 'reported');
  end if;

  if exists (
    select 1 from public.speed_dates sd
    where sd.status = 'active'
      and v_row.user_a_id in (sd.user_a_id, sd.user_b_id)
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'User A still in active speed date',
      'reason_code', 'user_still_active',
      'user_id', v_row.user_a_id
    );
  end if;

  if exists (
    select 1 from public.speed_dates sd
    where sd.status = 'active'
      and v_row.user_b_id in (sd.user_a_id, sd.user_b_id)
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'User B still in active speed date',
      'reason_code', 'user_still_active',
      'user_id', v_row.user_b_id
    );
  end if;

  if not exists (
    select 1 from public.queue_entries q
    where q.window_id = v_row.window_id
      and q.user_id = v_row.user_a_id
      and q.status = 'waiting'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'User A is not waiting in this window',
      'reason_code', 'not_waiting',
      'user_id', v_row.user_a_id
    );
  end if;

  if not exists (
    select 1 from public.queue_entries q
    where q.window_id = v_row.window_id
      and q.user_id = v_row.user_b_id
      and q.status = 'waiting'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'User B is not waiting in this window',
      'reason_code', 'not_waiting',
      'user_id', v_row.user_b_id
    );
  end if;

  if exists (
    select 1 from public.queue_entries q
    where q.window_id = v_row.window_id
      and q.user_id in (v_row.user_a_id, v_row.user_b_id)
      and q.status = 'paired'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'User already paired in queue',
      'reason_code', 'already_paired'
    );
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
    'user_b_id', v_row.user_b_id,
    'reason_code', 'committed'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM, 'reason_code', 'error');
end;
$$;

-- ---------------------------------------------------------------------------
-- Dev / orchestration helpers (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.seed_active_speed_date_ending_soon(
  p_window_id uuid,
  p_user_a_id uuid,
  p_user_b_id uuid,
  p_seconds_remaining integer default 30
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer := public.speed_date_duration_seconds();
  v_remaining integer := greatest(1, least(p_seconds_remaining, v_duration - 1));
  v_started_at timestamptz := now() - make_interval(secs => (v_duration - v_remaining));
  v_speed_date_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden: service_role only';
  end if;

  if p_user_a_id = p_user_b_id then
    raise exception 'Cannot create speed date with same user twice';
  end if;

  insert into public.speed_dates (window_id, user_a_id, user_b_id, status, started_at)
  values (p_window_id, p_user_a_id, p_user_b_id, 'active', v_started_at)
  returning id into v_speed_date_id;

  insert into public.queue_entries (window_id, user_id, status, joined_at)
  values
    (p_window_id, p_user_a_id, 'paired', v_started_at),
    (p_window_id, p_user_b_id, 'paired', v_started_at)
  on conflict (window_id, user_id) do update
  set status = 'paired', joined_at = excluded.joined_at;

  return v_speed_date_id;
end;
$$;

revoke all on function public.seed_active_speed_date_ending_soon(uuid, uuid, uuid, integer) from public;
grant execute on function public.seed_active_speed_date_ending_soon(uuid, uuid, uuid, integer) to service_role;

create or replace function public.end_speed_date_return_to_queue(p_speed_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.speed_dates%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden: service_role only';
  end if;

  select * into v_row
  from public.speed_dates
  where id = p_speed_date_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Speed date not found');
  end if;

  update public.speed_dates
  set status = 'completed', ended_at = now()
  where id = p_speed_date_id;

  update public.queue_entries
  set status = 'waiting', joined_at = now()
  where window_id = v_row.window_id
    and user_id in (v_row.user_a_id, v_row.user_b_id)
    and status = 'paired';

  return jsonb_build_object(
    'ok', true,
    'speed_date_id', p_speed_date_id,
    'window_id', v_row.window_id,
    'user_a_id', v_row.user_a_id,
    'user_b_id', v_row.user_b_id
  );
end;
$$;

revoke all on function public.end_speed_date_return_to_queue(uuid) from public;
grant execute on function public.end_speed_date_return_to_queue(uuid) to service_role;
