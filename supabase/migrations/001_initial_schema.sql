-- SpeedSpark initial schema
-- Run in Supabase Dashboard → SQL Editor, or via Supabase CLI: supabase db push

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null default '',
  age integer not null default 0 check (age >= 0 and age <= 120),
  height_inches integer not null default 0 check (height_inches >= 0),
  location_label text not null default '',
  location_latitude double precision,
  location_longitude double precision,
  gender_identity text not null default 'prefer_not_to_say',
  sexual_orientation text not null default 'prefer_not_to_say',
  looking_for text[] not null default '{}',
  queer_roles text[] not null default '{}',
  presentation_tags text[] not null default '{}',
  personality_tags text[] not null default '{}',
  lifestyle_tags text[] not null default '{}',
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  text_notifications_enabled boolean not null default true,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  public_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index profile_photos_user_id_idx on public.profile_photos (user_id);

-- ---------------------------------------------------------------------------
-- Dating preferences
-- ---------------------------------------------------------------------------

create table public.dating_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  age_range_min integer not null default 21,
  age_range_max integer not null default 40,
  height_min_inches integer not null default 60,
  height_max_inches integer not null default 84,
  max_distance_miles integer not null default 25,
  preferred_orientations text[] not null default '{}',
  preferred_looking_for text[] not null default '{}',
  preferred_queer_roles text[] not null default '{}',
  preferred_presentation_tags text[] not null default '{}',
  dealbreakers text[] not null default '{}',
  nice_to_haves text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Speed date windows & queue
-- ---------------------------------------------------------------------------

create table public.speed_date_windows (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  description text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  timezone text not null default 'America/New_York',
  is_live boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.speed_date_windows (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'paired', 'left')),
  joined_at timestamptz not null default now(),
  unique (window_id, user_id)
);

create index queue_entries_window_status_idx on public.queue_entries (window_id, status);

-- ---------------------------------------------------------------------------
-- Speed dates, feedback, matches, messages
-- ---------------------------------------------------------------------------

create table public.speed_dates (
  id uuid primary key default gen_random_uuid(),
  window_id uuid references public.speed_date_windows (id) on delete set null,
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  check (user_a_id <> user_b_id)
);

create table public.date_feedback (
  id uuid primary key default gen_random_uuid(),
  speed_date_id uuid not null references public.speed_dates (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  attractiveness_rating integer not null check (attractiveness_rating between 1 and 10),
  would_talk_again boolean not null default false,
  created_at timestamptz not null default now(),
  unique (speed_date_id, rater_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  speed_date_id uuid references public.speed_dates (id) on delete set null,
  matched_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (user_a_id <> user_b_id)
);

create unique index matches_pair_idx on public.matches (
  least(user_a_id, user_b_id),
  greatest(user_a_id, user_b_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  sent_at timestamptz not null default now()
);

create index messages_match_id_sent_at_idx on public.messages (match_id, sent_at);

-- ---------------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------------

create table public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  context text not null check (context in ('call', 'messages', 'profile')),
  speed_date_id uuid references public.speed_dates (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger dating_preferences_set_updated_at
before update on public.dating_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user → profile + preferences
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    display_name,
    age
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      trim(concat(
        coalesce(new.raw_user_meta_data->>'first_name', ''),
        ' ',
        coalesce(new.raw_user_meta_data->>'last_name', '')
      ))
    ),
    coalesce((new.raw_user_meta_data->>'age')::integer, 0)
  );

  insert into public.dating_preferences (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.dating_preferences enable row level security;
alter table public.speed_date_windows enable row level security;
alter table public.queue_entries enable row level security;
alter table public.speed_dates enable row level security;
alter table public.date_feedback enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocked_users enable row level security;
alter table public.reports enable row level security;

-- Profiles: read non-blocked profiles; write own
create policy "Profiles are viewable by authenticated users"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or not exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id)
       or (b.blocker_id = profiles.id and b.blocked_id = auth.uid())
  )
);

create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Profile photos
create policy "Photos viewable with profile access"
on public.profile_photos for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = profile_photos.user_id
  )
);

create policy "Users manage own photos"
on public.profile_photos for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Dating preferences
create policy "Users read own preferences"
on public.dating_preferences for select to authenticated
using (auth.uid() = user_id);

create policy "Users upsert own preferences"
on public.dating_preferences for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Speed date windows (public read for lobby)
create policy "Windows readable by authenticated users"
on public.speed_date_windows for select to authenticated
using (true);

-- Queue
create policy "Users manage own queue entries"
on public.queue_entries for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users read queue for live windows"
on public.queue_entries for select to authenticated
using (true);

-- Speed dates
create policy "Participants read own speed dates"
on public.speed_dates for select to authenticated
using (auth.uid() in (user_a_id, user_b_id));

-- Feedback (private to rater only)
create policy "Users manage own feedback"
on public.date_feedback for all to authenticated
using (auth.uid() = rater_id)
with check (auth.uid() = rater_id);

-- Matches
create policy "Participants read own matches"
on public.matches for select to authenticated
using (auth.uid() in (user_a_id, user_b_id));

-- Messages
create policy "Match participants read messages"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.matches m
    where m.id = messages.match_id
      and auth.uid() in (m.user_a_id, m.user_b_id)
  )
);

create policy "Match participants send messages"
on public.messages for insert to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and auth.uid() in (m.user_a_id, m.user_b_id)
  )
);

-- Blocked users
create policy "Users manage own blocks"
on public.blocked_users for all to authenticated
using (auth.uid() = blocker_id)
with check (auth.uid() = blocker_id);

-- Reports
create policy "Users create own reports"
on public.reports for insert to authenticated
with check (auth.uid() = reporter_id);

create policy "Users read own reports"
on public.reports for select to authenticated
using (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for profile photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Public read profile photos"
on storage.objects for select
using (bucket_id = 'profile-photos');

create policy "Users upload own profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users update own profile photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users delete own profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
