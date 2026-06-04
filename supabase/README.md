# SpeedSpark — Supabase backend

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy **Project URL** and **anon public** key from **Settings → API**.

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

Restart Expo after changing env vars:

```bash
npm start
```

## 3. Run the database migration

In the Supabase Dashboard, open **SQL Editor** and paste the contents of:

`supabase/migrations/001_initial_schema.sql`

Click **Run**. This creates:

- `profiles`, `profile_photos`, `dating_preferences`
- `speed_date_windows`, `queue_entries`, `speed_dates`
- `date_feedback`, `matches`, `messages`
- `blocked_users`, `reports`
- Row Level Security policies
- `profile-photos` storage bucket
- Trigger to create a profile row when a user signs up

## 4. Auth settings (recommended)

In **Authentication → Providers → Email**:

- Enable email sign-up
- For development, you can disable “Confirm email” so sign-up works immediately

Phone OTP can be added later (requires SMS provider).

## 5. What works today

| Feature | With `.env` configured |
|--------|-------------------------|
| Email sign up | Creates auth user + profile row |
| Email log in | Session persisted (web + native) |
| Profile onboarding save | Writes to `profiles` + `dating_preferences` |
| Block / unblock | Syncs to `blocked_users` |
| Phone sign up / OTP | Still uses demo flow (mock) |

Without `.env`, the app runs in **full demo mode** with mock data.

## 6. Optional: Supabase CLI

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

## Next backend steps

- Photo upload to `profile-photos` bucket
- Real-time messages subscription
- Queue pairing for speed dates
- Phone auth via Supabase + Twilio
