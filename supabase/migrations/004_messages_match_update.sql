-- Allow match participants to update last_message_at when sending messages
-- Run after 003_feedback_match_rpc.sql

create policy "Participants update own matches"
on public.matches for update to authenticated
using (auth.uid() in (user_a_id, user_b_id))
with check (auth.uid() in (user_a_id, user_b_id));
