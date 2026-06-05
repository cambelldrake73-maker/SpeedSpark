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

## 3. Run the database migrations

In the Supabase Dashboard, open **SQL Editor** and run **in order**:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_matching_queue_rpc.sql`

## 4. Enable Realtime (queue + speed dates)

In **Database → Replication**, enable Realtime for:

- `queue_entries`
- `speed_dates`
- `matches` (optional, for future messaging)

## 5. Auth settings (recommended)

In **Authentication → Providers → Email**:

- Enable email sign-up
- For development, you can disable “Confirm email” so sign-up works immediately

Phone OTP can be added later (requires SMS provider).

## 6. What works today

| Feature | With `.env` configured |
|--------|-------------------------|
| Email sign up | Creates auth user + profile row |
| Email log in | Session persisted (web + native) |
| Profile onboarding save | Writes to `profiles` + `dating_preferences` |
| Block / unblock | Syncs to `blocked_users` |
| Lobby queue join/leave | Writes to `queue_entries` |
| Queue counts (live window) | Read from `queue_entries` |
| Dev pairing engine | `apply_queue_pair` RPC + `pairingEngine.ts` |
| Phone sign up / OTP | Still uses demo flow (mock) |

Without `.env`, the app runs in **full demo mode** with mock data.

## 7. Testing queue & matching (dev)

After two test users have signed up and completed onboarding:

1. Run migration `002_matching_queue_rpc.sql`.
2. In Metro, open the dev console and run:

```js
await globalThis.SpeedSparkMatchingDev.seedDevLiveWindow()
// copy the returned window id
await globalThis.SpeedSparkMatchingDev.simulateQueuePopulation('WINDOW_ID', ['USER_A_UUID', 'USER_B_UUID'])
await globalThis.SpeedSparkMatchingDev.runDevPairing('WINDOW_ID')
await globalThis.SpeedSparkMatchingDev.printDevQueueReport('WINDOW_ID')
```

3. In the app lobby (with Supabase configured), **Join queue** writes a `queue_entries` row (`status: waiting`).
4. Confirm in **Table Editor** → `queue_entries` and `speed_dates` after pairing.

## 8. Optional: Supabase CLI

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

## Backend service map

| Service | Responsibility |
|---------|----------------|
| `queueService.ts` | join, leave, status, counts |
| `matchingService.ts` | compatibility score + filters |
| `matchingData.ts` | load profiles/prefs for waiting users |
| `pairingEngine.ts` | greedy pairing + RPC apply |
| `speedDates.ts` | active speed date reads + RPC |
| `windows.ts` | speed date windows CRUD/read |
| `realtimeSubscriptions.ts` | queue + speed date + match channels |
| `dev/matchingDev.ts` | seed window, simulate queue, run pairing |

## Next backend steps

- Wire `subscribeToSpeedDatesForUser` into queue UI when paired
- Photo upload to `profile-photos` bucket
- Real-time messages subscription
- Phone auth via Supabase + Twilio
