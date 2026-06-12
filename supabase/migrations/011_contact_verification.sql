-- Contact verification (SMS / voice call / email OTP) via Edge Functions + Twilio Verify / Resend.

create table if not exists public.contact_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  destination_normalized text not null,
  channel text not null check (channel in ('sms', 'call', 'email')),
  provider text not null check (provider in ('twilio', 'resend', 'dev')),
  provider_sid text,
  code_hash text,
  expires_at timestamptz not null,
  verified_at timestamptz,
  send_count int not null default 1,
  verify_attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists contact_verification_challenges_destination_idx
  on public.contact_verification_challenges (destination_normalized, channel, created_at desc);

-- Edge Functions use service_role only.
alter table public.contact_verification_challenges enable row level security;

comment on table public.contact_verification_challenges is
  'OTP send/verify audit trail. Codes are verified via Twilio Verify or stored hashed (Resend/dev email).';
