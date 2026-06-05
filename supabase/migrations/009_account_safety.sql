-- Account safety, moderation fields, and enforcement hooks
-- Run after 008_profile_photos_storage.sql

-- ---------------------------------------------------------------------------
-- Account status on profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
add column if not exists account_status text not null default 'active'
  check (account_status in ('active', 'suspended', 'deleted_request', 'deleted'));

alter table public.profiles
add column if not exists deletion_requested_at timestamptz;

alter table public.profiles
add column if not exists suspended_at timestamptz;

create index if not exists profiles_account_status_idx on public.profiles (account_status);

-- ---------------------------------------------------------------------------
-- Reports moderation fields
-- ---------------------------------------------------------------------------

alter table public.reports
add column if not exists status text not null default 'pending'
  check (status in ('pending', 'reviewed', 'dismissed', 'action_taken'));

alter table public.reports
add column if not exists admin_notes text;

alter table public.reports
add column if not exists updated_at timestamptz not null default now();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Profiles RLS — hide inactive accounts from other users
-- ---------------------------------------------------------------------------

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;

create policy "Profiles are viewable by authenticated users"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or (
    account_status = 'active'
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id)
         or (b.blocker_id = profiles.id and b.blocked_id = auth.uid())
    )
  )
);

-- Users may only set deleted_request on their own account (via RPC preferred).
-- Direct client updates to account_status are restricted to own row by existing update policy.

-- ---------------------------------------------------------------------------
-- Reports RLS — service role moderation access
-- ---------------------------------------------------------------------------

create policy "Service role manages all reports"
on public.reports for all to service_role
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- Account deletion request (client-safe)
-- ---------------------------------------------------------------------------

create or replace function public.request_account_deletion()
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

  update public.profiles
  set
    account_status = 'deleted_request',
    deletion_requested_at = now(),
    updated_at = now()
  where id = v_user_id;

  update public.queue_entries
  set status = 'left'
  where user_id = v_user_id
    and status in ('waiting', 'paired');

  update public.speed_dates
  set status = 'cancelled', ended_at = now()
  where status = 'active'
    and v_user_id in (user_a_id, user_b_id);
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

-- ---------------------------------------------------------------------------
-- Pairing — reject inactive accounts
-- ---------------------------------------------------------------------------

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
    select 1 from public.profiles p
    where p.id in (p_user_a_id, p_user_b_id)
      and p.account_status <> 'active'
  ) then
    raise exception 'Cannot pair inactive account';
  end if;

  if exists (
    select 1 from public.blocked_users b
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

-- ---------------------------------------------------------------------------
-- Matching context — only active waiting users
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
  inner join public.profiles p on p.id = q.user_id
  where q.window_id = p_window_id
    and q.status = 'waiting'
    and p.account_status = 'active';

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
        and p.account_status = 'active'
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
