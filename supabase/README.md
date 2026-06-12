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
3. `supabase/migrations/003_feedback_match_rpc.sql`
4. `supabase/migrations/004_messages_match_update.sql`
5. `supabase/migrations/005_matching_priority_order.sql`
6. `supabase/migrations/006_auto_pairing.sql`
7. `supabase/migrations/007_server_pairing.sql`
8. `supabase/migrations/008_profile_photos_storage.sql`
9. `supabase/migrations/009_account_safety.sql`
10. `supabase/migrations/010_speed_date_calls.sql`
11. `supabase/migrations/011_contact_verification.sql`
12. `supabase/migrations/012_dating_intentions.sql`
13. `supabase/migrations/013_pair_reservations.sql` — Queue Orchestration v2 Phase 1 (pre-match reservations)
14. `supabase/migrations/014_available_soon_pool.sql` — Phase 2 (Available Soon candidate pool)
15. `supabase/migrations/015_call_orchestration.sql` — Phase 5 (both-join timer, no-show RPCs)

See [docs/MODERATION.md](../docs/MODERATION.md) for report review and account status workflows.  
See [docs/LIVEKIT_SETUP.md](../docs/LIVEKIT_SETUP.md) for voice call setup (LiveKit + Edge Functions).  
See [docs/QUEUE_ORCHESTRATION_V2.md](../docs/QUEUE_ORCHESTRATION_V2.md) for reservation lifecycle (Phase 1).  
See [docs/CONTACT_VERIFICATION_SETUP.md](../docs/CONTACT_VERIFICATION_SETUP.md) for SMS / voice / email OTP setup (Twilio Verify + Resend).

## 4. Enable Realtime (queue + speed dates + feedback + messages)

In **Database → Replication**, enable Realtime for:

- `queue_entries`
- `speed_dates`
- `date_feedback`
- `matches`
- `messages`

## 5. Auth settings (recommended)

In **Authentication → Providers → Email**:

- Enable email sign-up
- For development, you can disable “Confirm email” so sign-up works immediately

Phone OTP can be added later (requires SMS provider).

For **real SMS, voice call, and email codes** on the contact verification screen, see [docs/CONTACT_VERIFICATION_SETUP.md](../docs/CONTACT_VERIFICATION_SETUP.md).

## 6. What works today

| Feature | With `.env` configured |
|--------|-------------------------|
| Email sign up | Creates auth user + profile row |
| Email log in | Session persisted (web + native) |
| Profile onboarding save | Writes to `profiles` + `dating_preferences` |
| Block / unblock | Syncs to `blocked_users` |
| Lobby queue join/leave | Writes to `queue_entries` |
| Queue counts (live window) | Read from `queue_entries` |
| Automatic pairing | Client worker (15s) + optional Edge Function cron |
| Dev pairing engine | `SpeedSparkMatchingDev.runDevPairing()` still available |
| Post-date feedback | `date_feedback` via `submit_date_feedback_and_resolve` RPC |
| Mutual matches | `matches` row when both users say yes |
| Messaging | `messages` table + realtime thread updates |
| Phone sign up / OTP | Real codes via Twilio Verify when Edge Function secrets are set |

Without `.env`, the app runs in **full demo mode** with mock data.

## 7. Automatic pairing (production)

Matching and pairing execute **server-side only** (Edge Function + service role). Client RLS on `dating_preferences` is unchanged.

### Architecture

1. **`get_window_matching_context` RPC** (`007_server_pairing.sql`) — `SECURITY DEFINER`, **`service_role` only**. Returns profiles + preferences for **waiting** queue users in one window, plus blocks, reports, recent pairs, and appearance scores. No broad RLS weakening.
2. **`pair-live-windows` Edge Function** — runs `pairingEngine` with service role, calls the RPC for candidate data, applies greedy pairing, writes `pairing_run_logs`.
3. **In-app worker** (`PairingWorkerBootstrap`) — every **15s**, invokes the Edge Function (does not run matching locally).
4. **Distributed locks** (`006`) + **`apply_queue_pair` RPC** — prevent duplicate pairs and race failures.

Pairing runs automatically when:

1. **In-app worker** — logged-in user triggers Edge Function invoke every 15s.
2. **Edge Function cron (recommended for 24/7)** — schedule `pair-live-windows` independently of app sessions.

### Deploy Edge Function

```bash
supabase secrets set PAIRING_CRON_SECRET=your-random-secret
supabase functions deploy pair-live-windows --no-verify-jwt
```

Add to `.env` (same secret value):

```
EXPO_PUBLIC_PAIRING_INVOKE_SECRET=your-random-secret
```

Schedule via **Dashboard → Edge Functions → pair-live-windows → Cron** (e.g. `*/15 * * * * *` every 15s if supported, or every minute: `* * * * *`).

Or invoke manually:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/pair-live-windows" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "x-pairing-secret: your-random-secret"
```

The Edge Function uses the **service role** and `get_window_matching_context` for scoped, auditable matching reads.

### Configuration

Edit `src/constants/autoPairing.ts`:

- `AUTO_PAIRING_INTERVAL_MS` — client worker interval (default 15000)
- `PAIRING_LOCK_TTL_SECONDS` — distributed lock TTL (default 25)
- `PAIRING_MIN_WAITING_USERS` — minimum queue size before pairing (default 2)

### Logs

- Metro console: `[SpeedSpark Backend] pairing.*` events
- Database: `pairing_run_logs` table (pairs created, unmatched, skipped)

## 8. Testing queue & matching (dev)

After two test users have signed up and completed onboarding:

1. Run migrations through `007_server_pairing.sql`.
2. Seed a live window (if none exists):

```js
await globalThis.SpeedSparkMatchingDev.seedDevLiveWindow()
```

3. Both users: open app → lobby → **Join queue** (or simulate):

```js
await globalThis.SpeedSparkMatchingDev.simulateQueuePopulation('WINDOW_ID', ['USER_A_UUID', 'USER_B_UUID'])
```

4. **Automatic pairing** should create a `speed_dates` row within ~15s (no manual `runDevPairing` required). Both apps navigate to Active Date via realtime.

5. Manual override still works:

```js
await globalThis.SpeedSparkMatchingDev.runDevPairing('WINDOW_ID')
await globalThis.SpeedSparkMatchingDev.printDevQueueReport('WINDOW_ID')
```

6. Confirm in **Table Editor** → `queue_entries`, `speed_dates`, `pairing_run_logs`.

### Testing reservations (Phase 1 — plan early, commit late)

Requires migration **013** and redeployed `pair-live-windows` Edge Function.

1. Seed a window and queue two users (same as above, or use reservation-specific seed):

```js
const windowId = await SpeedSparkMatchingDev.seedReservationTestWindow()
await SpeedSparkMatchingDev.simulateQueuePopulation(windowId, ['USER_A_UUID', 'USER_B_UUID'])
```

2. **Plan** — create pending reservations (no `speed_dates` row yet):

```js
await SpeedSparkMatchingDev.runDevReservationPlan(windowId)
// or: const reservationId = await SpeedSparkMatchingDev.createTestReservation(windowId)
```

3. Inspect holds:

```js
await SpeedSparkMatchingDev.printReservationReport(windowId)
```

4. **Commit** — re-validates gates, creates `speed_dates`, sets queue `paired`:

```js
await SpeedSparkMatchingDev.commitTestReservation('RESERVATION_UUID')
```

5. **Expire** stale pending reservations (TTL default 90s):

```js
await SpeedSparkMatchingDev.expireStaleReservations()
```

6. Confirm in **Table Editor** → `pair_reservations`, then `speed_dates` after commit.

**Immediate pairing still works:** `runDevPairing(windowId)` uses `apply_queue_pair` directly (unchanged v1 path).

Edge Function body options (same secret as pairing):

| Body | Effect |
|------|--------|
| `{ "windowId": "...", "mode": "plan" }` | Score + create reservations |
| `{ "action": "commit", "reservationId": "..." }` | Commit one reservation |
| `{ "action": "expire" }` | Expire stale pending rows |
| `{ "windowId": "...", "action": "report" }` | List reservations for window |
| `{ "windowId": "...", "action": "seedActiveDate", "userAId": "...", "userBId": "...", "secondsRemaining": 30 }` | Dev: active date ending soon |
| `{ "action": "endSpeedDate", "speedDateId": "..." }` | Dev: complete date + return users to waiting |

### Testing Available Soon (Phase 2)

Requires migrations **013 + 014** and redeployed `pair-live-windows`.

Scenario: User A waiting, Users B+C on active dates ending soon (with each other or separate partners).

```js
const windowId = await SpeedSparkMatchingDev.seedReservationTestWindow()

// B and C on an active date with ~30s left (server backdates started_at)
const speedDateId = await SpeedSparkMatchingDev.seedActiveDatesEndingSoon(windowId, 'USER_B', 'USER_C', 30)

// A joins queue normally
await SpeedSparkMatchingDev.simulateQueuePopulation(windowId, ['USER_A'])

// Plan — should reserve A+B or A+C (available-soon), not commit until available
await SpeedSparkMatchingDev.planReservationsWithAvailableSoon(windowId)
await SpeedSparkMatchingDev.printReservationReport(windowId)

// Commit before date ends should fail (user still active)
await SpeedSparkMatchingDev.commitTestReservation('RESERVATION_UUID')

// Fast-forward: end active date, both users return to waiting
await SpeedSparkMatchingDev.completeActiveDateForTesting(speedDateId)

// Or one-shot: complete dates then commit
await SpeedSparkMatchingDev.commitReservationAfterAvailability('RESERVATION_UUID', [speedDateId])
```

Logs to watch in Metro: `matchingData.serverBundle`, `reservation.plan.availableSoonFound`, `orchestration.runLogged`, `orchestration.report`.

### Orchestration metrics (Phase 3)

After plan/commit/expire activity:

```js
await SpeedSparkMatchingDev.printOrchestrationReport(windowId)
await SpeedSparkMatchingDev.printReservationMetrics(windowId)
```

Confirm structured metrics in **Table Editor** → `pairing_run_logs.details` (`runMode`, `reservationSuccessRate`, `commitFailureReasonCounts`, etc.).

## 9. Testing feedback & mutual matches

After both users complete the same speed date (pair → Active Date → timer ends):

1. Run migration `003_feedback_match_rpc.sql`.
2. **User A** submits feedback with **Yes**.
3. User A should see **Waiting to hear back** on the match result screen.
4. **User B** submits feedback with **Yes**.
5. Confirm `date_feedback` has two rows and `matches` has one row for the pair.
6. Both users should see **It's a mutual match!** and **Send a message** opens `Messages` with the real `matchId` UUID.
7. If either user submits **No**, no `matches` row is created.

## 10. Testing messages

After a mutual match exists:

1. Run migration `004_messages_match_update.sql`.
2. From **Match result**, tap **Send a message** (real `matchId` in route).
3. Send a message — confirm a row in `messages` and `matches.last_message_at` updated.
4. Open **Messages** on the second user — message appears via realtime or refresh.
5. Match list shows the real partner profile name.

## 11. Optional: Supabase CLI

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
| `orchestrationMetrics.ts` | run metrics, reservation rollup, dev reports |
| `pairingRunLog.ts` | persist immediate / plan / commit / expire runs |
| `pairingCoordinator.ts` | scan live windows, locks, run logs; optional reservation plan |
| `queueOrchestrator.ts` | `planPairsForWindow` — reservations without immediate commit |
| `reservationService.ts` | create / expire / cancel / commit reservation RPCs |
| `autoPairingWorker.ts` | in-app interval worker |
| `speedDates.ts` | active speed date reads + RPC |
| `dateFeedback.ts` | submit feedback, resolve mutual match |
| `messages.ts` | match list, threads, send message |
| `windows.ts` | speed date windows CRUD/read |
| `realtimeSubscriptions.ts` | queue + speed date + feedback + match + message channels |
| `dev/matchingDev.ts` | seed window, simulate queue, run pairing, reservation dev helpers |
| `dev/reservationDev.ts` | reservation plan/commit/expire/report (also `SpeedSparkReservationDev`) |

## 12. Profile photos

Bucket: `profile-photos` (public read, per-user write folder `{userId}/{photoId}.ext`).

| Step | Action |
|------|--------|
| Upload | Settings → Manage profile, or onboarding (optional when Supabase on) |
| Storage | Supabase Dashboard → Storage → `profile-photos` |
| Metadata | Table Editor → `profile_photos` |
| Limits | JPEG/PNG/WebP, max 5 MB |

After upload, restart or re-open the app — `fetchProfile` loads `profile_photos` into `UserProfile.photos`.

## 13. Voice calls (LiveKit Phase 1)

| Step | Action |
|------|--------|
| Migration | Run `010_speed_date_calls.sql` then `015_call_orchestration.sql` |
| LiveKit | Create LiveKit Cloud project; set secrets on Supabase |
| Deploy | `create-call-room`, `get-call-token` Edge Functions |
| Test | Web: two browsers. Native: EAS dev build (not Expo Go) |

Secrets (Supabase only — **not** in app `.env`):

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL` (e.g. `wss://your-project.livekit.cloud`)

Full guide: **[docs/LIVEKIT_SETUP.md](../docs/LIVEKIT_SETUP.md)**

## Next backend steps

- Tune Edge Function cron frequency for your window size
- Phone auth via Supabase + Twilio
