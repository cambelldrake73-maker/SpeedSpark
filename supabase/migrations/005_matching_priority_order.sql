-- Ranked matching priority order (most important → least important)
-- Run after 004_messages_match_update.sql

alter table public.dating_preferences
add column if not exists matching_priority_order text[] not null default array[
  'datingIntentionFit',
  'queerRoleFit',
  'presentationFit',
  'appearanceFit',
  'ageFit',
  'distanceFit',
  'personalityVibeFit',
  'lifestyleFit',
  'heightFit'
]::text[];
