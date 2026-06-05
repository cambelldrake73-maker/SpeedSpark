-- Profile photos storage (idempotent — safe if 001 already created bucket/policies)
-- Run after 007_server_pairing.sql
--
-- Design: PUBLIC read bucket so match partners can view profile photos in-app.
-- Writes are scoped to each user's folder: {userId}/{photoId}.ext
-- Authenticated users may only insert/update/delete objects in their own folder.
-- No service role keys in the client — uploads use the user session + Storage RLS.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read profile photos" on storage.objects;
create policy "Public read profile photos"
on storage.objects for select
using (bucket_id = 'profile-photos');

drop policy if exists "Users upload own profile photos" on storage.objects;
create policy "Users upload own profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own profile photos" on storage.objects;
create policy "Users update own profile photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own profile photos" on storage.objects;
create policy "Users delete own profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- profile_photos table RLS (from 001) — users manage own rows only.
-- No changes needed; documented here for operators.
