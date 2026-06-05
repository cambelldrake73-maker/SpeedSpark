-- Server-side matching data access (SECURITY DEFINER, service_role only)
-- Run after 006_auto_pairing.sql
--
-- Does NOT weaken dating_preferences or profiles RLS for clients.
-- Pairing reads candidate data only through these RPCs from the Edge Function.

-- ---------------------------------------------------------------------------
-- Matching context bundle (waiting queue users in one window only)
-- ---------------------------------------------------------------------------

create or replace function public.get_window_matching_context(p_window_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_waiting_user_ids uuid[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden: server pairing context only';
  end if;

  select array_agg(q.user_id order by q.joined_at)
  into v_waiting_user_ids
  from public.queue_entries q
  where q.window_id = p_window_id
    and q.status = 'waiting';

  if v_waiting_user_ids is null then
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
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'queueEntryId', q.id,
          'userId', q.user_id,
          'joinedAt', q.joined_at,
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
            'lookingFor', to_jsonb(p.looking_for),
            'queerRoles', to_jsonb(p.queer_roles),
            'presentationTags', to_jsonb(p.presentation_tags),
            'personalityTags', to_jsonb(p.personality_tags),
            'lifestyleTags', to_jsonb(p.lifestyle_tags),
            'verificationStatus', p.verification_status
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
        order by q.joined_at
      ), '[]'::jsonb)
      from public.queue_entries q
      inner join public.profiles p on p.id = q.user_id
      inner join public.dating_preferences dp on dp.user_id = q.user_id
      where q.window_id = p_window_id
        and q.status = 'waiting'
    ),
    'blockedEdges', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'blockerId', b.blocker_id,
        'blockedId', b.blocked_id
      )), '[]'::jsonb)
      from public.blocked_users b
      where b.blocker_id = any (v_waiting_user_ids)
        and b.blocked_id = any (v_waiting_user_ids)
    ),
    'reportedPairKeys', (
      select coalesce(jsonb_agg(
        least(r.reporter_id::text, r.reported_id::text) || ':' ||
        greatest(r.reporter_id::text, r.reported_id::text)
      ), '[]'::jsonb)
      from public.reports r
      where r.reporter_id = any (v_waiting_user_ids)
        and r.reported_id = any (v_waiting_user_ids)
    ),
    'recentPairKeys', (
      select coalesce(jsonb_agg(distinct
        least(sd.user_a_id::text, sd.user_b_id::text) || ':' ||
        greatest(sd.user_a_id::text, sd.user_b_id::text)
      ), '[]'::jsonb)
      from public.speed_dates sd
      where sd.started_at >= now() - interval '14 days'
        and sd.user_a_id = any (v_waiting_user_ids)
        and sd.user_b_id = any (v_waiting_user_ids)
    ),
    'appearanceScores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'viewerId', df.rater_id,
        'partnerId', df.partner_id,
        'score', greatest(0, least(100, df.attractiveness_rating * 10))
      )), '[]'::jsonb)
      from public.date_feedback df
      where df.rater_id = any (v_waiting_user_ids)
        and df.partner_id = any (v_waiting_user_ids)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue hygiene before pairing (race / stale protection)
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_stale_queue_entries(p_window_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paired_synced integer := 0;
  v_marked_left integer := 0;
  v_stale_removed integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden: server pairing context only';
  end if;

  -- Sync queue rows for users already in an active speed date for this window
  update public.queue_entries q
  set status = 'paired'
  from public.speed_dates sd
  where q.window_id = p_window_id
    and q.status = 'waiting'
    and sd.window_id = p_window_id
    and sd.status = 'active'
    and q.user_id in (sd.user_a_id, sd.user_b_id);
  get diagnostics v_paired_synced = row_count;

  -- Window no longer live — release waiters
  update public.queue_entries q
  set status = 'left'
  from public.speed_date_windows w
  where q.window_id = p_window_id
    and q.status = 'waiting'
    and w.id = p_window_id
    and w.is_live = false;
  get diagnostics v_marked_left = row_count;

  -- Abandoned waiters (stale)
  update public.queue_entries
  set status = 'left'
  where window_id = p_window_id
    and status = 'waiting'
    and joined_at < now() - interval '4 hours';
  get diagnostics v_stale_removed = row_count;

  return jsonb_build_object(
    'pairedSynced', v_paired_synced,
    'markedLeft', v_marked_left,
    'staleRemoved', v_stale_removed
  );
end;
$$;

revoke all on function public.get_window_matching_context(uuid) from public;
grant execute on function public.get_window_matching_context(uuid) to service_role;

revoke all on function public.cleanup_stale_queue_entries(uuid) from public;
grant execute on function public.cleanup_stale_queue_entries(uuid) to service_role;
