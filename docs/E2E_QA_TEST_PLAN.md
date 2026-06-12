# SpeedSpark — End-to-End QA Test Plan & Bug Bash Checklist

**Purpose:** Pre-beta validation and structured bug bash for 10–20 invited testers.  
**Audience:** Founders, QA, moderators, and internal testers before closed beta.  
**Last updated:** 2026-06-02

**Source docs:** [PROJECT_INVENTORY.md](./PROJECT_INVENTORY.md) · [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) · [MATCHING_FRAMEWORK.md](./MATCHING_FRAMEWORK.md) · [QUEUE_ORCHESTRATION_V2.md](./QUEUE_ORCHESTRATION_V2.md) · [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md) · [EAS_BUILD_READINESS.md](./EAS_BUILD_READINESS.md)

**Scope:** Documentation only — no code changes in this milestone.

---

## How to use this document

| Section | When |
|---------|------|
| §1 Required setup | Once per environment (staging/prod Supabase) |
| §2 Test accounts | Before first internal dry run |
| §3 Critical happy path | **Must pass** before inviting testers |
| §4 Failure cases | Bug bash night 1 |
| §5 Matching tests | Bug bash night 2 (dev console + DB inspection) |
| §6 Mobile tests | Before distributing EAS builds |
| §7 Pass/fail criteria | Go/no-go gate |
| §8 Bug report template | Share with all testers |
| §9 Beta readiness score | Final decision |

**Status key:** ☐ Not run · ✅ Pass · ❌ Fail · ⚠️ Pass with known limitation

---

## 1. Required setup

Complete **before any E2E run**. Demo mode (no `.env`) is invalid for beta QA.

### 1.1 Supabase migrations (001–015)

Run in **SQL Editor**, in order ([supabase/README.md](../supabase/README.md)):

| # | Migration | Required for |
|---|-----------|--------------|
| 001 | `001_initial_schema.sql` | Core tables, RLS, storage bucket |
| 002 | `002_matching_queue_rpc.sql` | `apply_queue_pair` |
| 003 | `003_feedback_match_rpc.sql` | Feedback + mutual match RPCs |
| 004 | `004_messages_match_update.sql` | `matches.last_message_at` |
| 005 | `005_matching_priority_order.sql` | Ranked preferences |
| 006 | `006_auto_pairing.sql` | Auto-pairing support |
| 007 | `007_server_pairing.sql` | `get_window_matching_context` RPC |
| 008 | `008_profile_photos_storage.sql` | `profile-photos` bucket + policies |
| 009 | `009_account_safety.sql` | Account status, deletion request, reports |
| 010 | `010_speed_date_calls.sql` | LiveKit call rows |
| 011 | `011_contact_verification.sql` | Contact verify (optional for email-only beta) |
| 012 | `012_dating_intentions.sql` | Dating intentions schema alignment |
| 013 | `013_pair_reservations.sql` | Reservation holds (Queue Orchestration v2) |
| 014 | `014_available_soon_pool.sql` | Available Soon planning pool |
| 015 | `015_call_orchestration.sql` | Both-join timer, no-show RPCs |

**Verify:**

- [ ] No SQL errors on apply
- [ ] `\dt` shows all expected tables (`profiles`, `queue_entries`, `speed_dates`, `speed_date_calls`, `pair_reservations`, `pairing_run_logs`, etc.)
- [ ] RPCs exist: `apply_queue_pair`, `submit_date_feedback_and_resolve`, `get_speed_date_match_result`, `get_window_matching_context`, `mark_call_participant_joined`, `cancel_call_no_show`, `complete_call_if_valid`

### 1.2 Edge Functions deployed

| Function | Purpose | Required |
|----------|---------|----------|
| `pair-live-windows` | Server-side pairing + reservation orchestration | **Yes** |
| `create-call-room` | LiveKit room + `speed_date_calls` row | **Yes** (voice beta) |
| `get-call-token` | Mint LiveKit JWT for participants | **Yes** (voice beta) |
| `send-contact-verification` | OTP send (Twilio/Resend) | Optional (email signup path skips) |
| `verify-contact-code` | OTP verify | Optional |

**Deploy:**

```bash
supabase functions deploy pair-live-windows
supabase functions deploy create-call-room
supabase functions deploy get-call-token
```

**Secrets (Supabase Dashboard → Edge Functions → Secrets):**

| Secret | Used by |
|--------|---------|
| `PAIRING_CRON_SECRET` | `pair-live-windows` |
| `LIVEKIT_API_KEY` | `create-call-room`, `get-call-token` |
| `LIVEKIT_API_SECRET` | `create-call-room`, `get-call-token` |
| `LIVEKIT_URL` | `create-call-room`, `get-call-token` |

**App `.env` (must match pairing secret):**

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_PAIRING_INVOKE_SECRET=...   # same value as PAIRING_CRON_SECRET
```

**Verify:**

- [ ] Cron scheduled on `pair-live-windows` (recommended: every 1 min minimum; 15s if supported)
- [ ] Smoke invoke returns 200:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/pair-live-windows" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "x-pairing-secret: YOUR_SECRET"
```

- [ ] After two users join queue, `pairing_run_logs` receives new rows within ~30s

### 1.3 LiveKit secrets

Per [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md):

- [ ] LiveKit Cloud project created; **recording/egress disabled**
- [ ] `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` set on Supabase (never in app `.env`)
- [ ] Both Edge Functions redeployed after secrets set

### 1.4 EAS dev build (native voice)

**Expo Go is not valid for LiveKit voice QA.**

Per [EAS_BUILD_READINESS.md](./EAS_BUILD_READINESS.md):

- [ ] `expo-dev-client` installed; config plugins in `app.json`
- [ ] EAS project linked (`eas build:configure`)
- [ ] EAS secrets set for `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_PAIRING_INVOKE_SECRET`
- [ ] At least one build completed:
  - iOS: `eas build --profile development --platform ios` (or `development-simulator`)
  - Android: `eas build --profile development --platform android`
- [ ] Dev client connects to Metro: `npm run start:dev`

**Web** is acceptable for pairing/messaging QA and partial voice QA (two browser profiles).

### 1.5 Realtime enabled tables

**Database → Replication** — enable for:

- [ ] `queue_entries`
- [ ] `speed_dates`
- [ ] `date_feedback`
- [ ] `matches`
- [ ] `messages`

**Without Realtime:** pair detection and chat may lag; MatchResult polls every 3s as fallback.

### 1.6 Storage bucket

- [ ] Bucket `profile-photos` exists (migration 008)
- [ ] Policies: public read; user-scoped write `{userId}/…`
- [ ] Test upload from Manage Profile → file in Storage + row in `profile_photos`

### 1.7 Auth settings

- [ ] Email provider enabled
- [ ] Beta decision documented: email confirm on/off
- [ ] Test accounts use dedicated emails (not production user PII)

### 1.8 Seed data

- [ ] Live row in `speed_date_windows` during beta window (`is_live = true`, correct timezone)
- [ ] Dev helper (optional): `await SpeedSparkMatchingDev.seedDevLiveWindow()`

---

## 2. Test accounts needed

Minimum **4 Supabase accounts** (6+ recommended for matching/reservation edge cases).

### 2.1 Account roster

| ID | Email pattern | Role in QA |
|----|---------------|------------|
| **A** | `qa-a+…@yourdomain.test` | Primary happy-path user |
| **B** | `qa-b+…@yourdomain.test` | Primary pair partner |
| **C** | `qa-c+…@yourdomain.test` | Gender-gate negative / third in queue |
| **D** | `qa-d+…@yourdomain.test` | Distance / age edge / no-show scenario |

Optional **E, F** for Available Soon + reservation planning (one finishes date while other waits).

### 2.2 Suggested profiles (matching coverage)

Design profiles so pairing engine behavior is observable. Adjust coordinates for your beta city.

| User | Gender | `preferredLookingFor` | Age | Location | Max distance | Notes |
|------|--------|----------------------|-----|----------|--------------|-------|
| **A** | woman | `[man, nonbinary]` | 28 | NYC | 50 mi | Baseline; mutual with B |
| **B** | man | `[woman]` | 30 | NYC | 50 mi | Mutual with A |
| **C** | woman | `[woman]` | 27 | NYC | 50 mi | **Should not pair with A or B** (gender gate) |
| **D** | nonbinary | `[woman, man]` | 35 | ~200 mi away | 25 mi | **Distance gate** with A/B if coords set |

**Additional preference variants (same or extra accounts):**

- **Age soft gate:** User with `ageRangeMin=25`, `ageRangeMax=32` vs partner age 40 → lower score, not hard-blocked
- **Missing data neutral:** User with empty `lifestyleTags` → neutral 50 on lifestyle (not 0)
- **Priority order:** User ranks `presentationFit` first vs user ranking `distanceFit` first → verify different pair preference when scores tie (dev console: `SpeedSparkMatchingDev.compareDevMatchScores`)

### 2.3 Onboarding checklist per account

Each account must complete before queue tests:

- [ ] Profile saved to `profiles`
- [ ] At least 1 photo uploaded (Manage Profile) — verify Storage + `profile_photos`
- [ ] `dating_preferences` row with `preferredLookingFor` ≥ 1
- [ ] `profiles.onboarded_at` set (Verification step complete)

---

## 3. Critical happy path

Run with **Account A + B** on **two devices** (or web + native). Mark each step.

### HP-1 Signup

| Step | Action | Expected | DB / logs |
|------|--------|----------|-----------|
| 1 | Welcome → Sign up → email + password | Account created; route to Profile Creation | `auth.users`, `profiles` row |
| 2 | Repeat for User B | Same | Same |

**Result:** ☐ ✅ ❌

### HP-2 Onboarding

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Complete Profile Creation (name, age, location, identity, tags) | Navigate to Preferences | `profiles` updated |
| 2 | Complete Preferences (ranges, priorities) | Navigate to Verification | `dating_preferences` |
| 3 | Complete Verification (placeholder) | Land on Speed Date Lobby | `onboarded_at` set |

**Result:** ☐ ✅ ❌

### HP-3 Photos

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Settings → Manage Profile → add 1–3 photos → Save | Photos visible | Storage + `profile_photos` |
| 2 | Kill app → reopen | Photos still load | URLs resolve |

**Result:** ☐ ✅ ❌

### HP-4 Join queue

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Lobby shows **live** window | Window visible | `speed_date_windows.is_live` |
| 2 | User A joins queue | Searching state | `queue_entries.status = waiting` |
| 3 | User B joins queue | Both searching | Two waiting rows |
| 4 | Lobby count updates | Realtime count | — |

**Result:** ☐ ✅ ❌

### HP-5 Automatic pairing

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Wait ≤30s (15s worker + cron) | Both navigate to ActiveDate | `speed_dates` INSERT |
| 2 | Confirm `speedDateId` in route | Real UUID param | `status = active` |
| 3 | — | `queue_entries.status = paired` | `pairing_run_logs` row |

**Fallback if stuck:** `SpeedSparkMatchingDev.runDevPairing(windowId)` — **fail the test** if required for beta night.

**Result:** ☐ ✅ ❌

### HP-6 LiveKit voice call

| Step | Action | Expected | DB / logs |
|------|--------|----------|-----------|
| 1 | Grant mic (and camera if prompted) | Connecting → Waiting for date… | `call.room.joining` |
| 2 | Both users connect | Voice connected; partner pane updates | `mark_call_participant_joined` |
| 3 | Speak on A, listen on B | Audible audio (web or dev build) | LiveKit room 2 participants |
| 4 | — | `speed_date_calls` row exists | `room_name`, `status` |

**Note:** Partner **video** remains placeholder — voice-only Phase 1.

**Result:** ☐ ✅ ❌

### HP-7 Both-join timer

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Observe timer on ActiveDate mount | **Full duration shown; countdown paused** | — |
| 2 | Both join LiveKit room | Countdown **starts** | `both_joined_at` set |
| 3 | — | `call.timer.started` in logs | `speed_date_calls.status = active` |

**Dev builds:** 60s timer. Production: 300s.

**Result:** ☐ ✅ ❌

### HP-8 Feedback

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Timer expires OR End date early (after both joined) | PostDateFeedback screen | — |
| 2 | User A: rate 1–10 + Yes/No → Submit | Match Result (waiting) | `date_feedback` row |
| 3 | User B: Submit | Match Result updates | Second feedback row |
| 4 | — | `speed_dates.status = completed` | `complete_call_if_valid` |

**Result:** ☐ ✅ ❌

### HP-9 Mutual match

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Both submit **Yes** | Mutual match UI | `matches` row |
| 2 | Tap message CTA | Messages opens with `matchId` | — |

**Result:** ☐ ✅ ❌

### HP-10 Messaging

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | A sends message | Appears in thread | `messages` INSERT |
| 2 | B receives (Realtime) | Message visible without manual refresh | — |
| 3 | B replies | A receives | `matches.last_message_at` updates |

**Result:** ☐ ✅ ❌

### Happy path summary

| # | Flow | Result |
|---|------|--------|
| HP-1 | Signup | ☐ |
| HP-2 | Onboarding | ☐ |
| HP-3 | Photos | ☐ |
| HP-4 | Join queue | ☐ |
| HP-5 | Pairing | ☐ |
| HP-6 | Voice call | ☐ |
| HP-7 | Both-join timer | ☐ |
| HP-8 | Feedback | ☐ |
| HP-9 | Mutual match | ☐ |
| HP-10 | Messaging | ☐ |

**Critical path passes only if HP-1 through HP-10 are ✅** (HP-6/7 may be ⚠️ on Expo Go — use web or dev build).

---

## 4. Failure cases

Bug bash scenarios — expect graceful handling, not crashes.

### FC-1 One user never joins call

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Pair A + B → ActiveDate | A grants mic, connects | — |
| 2 | B **does not** open ActiveDate (or denies mic) | A sees “Waiting for date…” | — |
| 3 | Wait **45s** (join grace) | A returned to **Lobby**; **no feedback** | `cancel_reason = no_show` |
| 4 | — | A back in queue (`waiting`) | B `queue_entries.status = left` |

**Result:** ☐ ✅ ❌

### FC-2 User disconnects mid-call

| Step | Action | Expected |
|------|--------|----------|
| 1 | Both joined; timer running | — |
| 2 | B kills app or disables network ~30s | A sees reconnecting / partner disconnected |
| 3 | B reopens within **20s** | Call continues; timer not reset |
| 4 | B stays offline >20s | A routed to feedback (partner abandoned) |

**Result:** ☐ ✅ ❌

### FC-3 Report during date

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | ActiveDate → Report → confirm | Date ends → feedback flow | `reports.context = call` |
| 2 | — | Report row `status = pending` | — |

**Result:** ☐ ✅ ❌

### FC-4 Block during date

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | ActiveDate → Block → confirm | Navigate to Lobby; call torn down | `blocked_users` |
| 2 | — | `speed_dates.status = cancelled` | — |
| 3 | Re-queue both | Pairing skips blocked pair | — |

**Result:** ☐ ✅ ❌

### FC-5 Leave queue

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Join queue → Leave | Returns to idle lobby state | `queue_entries` removed or `left` |
| 2 | — | User not paired while left | — |

**Result:** ☐ ✅ ❌

### FC-6 Message after block

| Step | Action | Expected |
|------|--------|----------|
| 1 | A blocks B (from date or messages) | — |
| 2 | A tries to open Messages with B | Thread hidden or send fails gracefully |
| 3 | Re-pair in same window | Engine should not pair blocked users |

**Result:** ☐ ✅ ❌

### FC-7 Account deletion request

| Step | Action | Expected | DB |
|------|--------|----------|-----|
| 1 | Settings → Delete account → confirm | Signed out → Welcome | `account_status = deleted_request` |
| 2 | Sign in again | Cannot participate (hydrate error or blocked) | — |
| 3 | Try join queue | Error: account cannot participate | — |

**Note:** Auth user is **not** purged — manual admin cleanup per [MODERATION.md](./MODERATION.md).

**Result:** ☐ ✅ ❌

### FC-8 End date early before both join

| Step | Action | Expected |
|------|--------|----------|
| 1 | A on ActiveDate, partner not connected | Timer not running |
| 2 | End date early | Cancels call; navigates appropriately (no `complete_call_if_valid` without both joined) |

**Result:** ☐ ✅ ❌

---

## 5. Matching tests

Requires dev console access (`SpeedSparkMatchingDev`) and Supabase Table Editor / SQL.

### MT-1 PreferredLookingFor gate (hard)

| Setup | Action | Expected |
|-------|--------|----------|
| A: woman seeking men; B: man seeking women | `compareDevMatchScores(A,B)` or pair | Compatible |
| A + C: woman seeking women only | Compare or pair | **Blocked** — gender gate |
| Empty `preferredLookingFor` (SQL only) | Pair attempt | **Fail closed** — rejected |

**Dev:** `await SpeedSparkMatchingDev.runMatchingFrameworkTests()`

**Result:** ☐ ✅ ❌

### MT-2 Age gate (soft)

| Setup | Expected |
|-------|----------|
| Viewer age range 25–32; partner age 40 | Pair may form if mutual score passes wait threshold; **ageFit < 100**, not hard-block |
| Missing age on one profile | Neutral 50 on ageFit |

**Result:** ☐ ✅ ❌

### MT-3 Distance gate (hard when coords present)

| Setup | Expected |
|-------|----------|
| Both NYC, max distance 50 mi | Passes distance hard gate |
| D ~200 mi away, max 25 mi | **Hard blocked** when lat/lng on both |

**Result:** ☐ ✅ ❌

### MT-4 Adaptive wait threshold (Phase 4)

| Setup | Expected |
|-------|----------|
| Fresh wait + large pool (21+ waiting) | Minimum mutual score **70** |
| Long wait + small pool | Lower floor (~48); hard gates unchanged |
| Score below 40 | Never accepted |

**Dev:** `await SpeedSparkMatchingDev.testWaitPolicy()` · `printWaitPolicyTable()`

**Inspect:** `pairing_run_logs.details` → `waitBucket`, `minimumScoreApplied`, `rejectedBelowThresholdCount`

**Result:** ☐ ✅ ❌

### MT-5 Available Soon reservation (Phase 2)

| Setup | Action | Expected |
|-------|--------|----------|
| User E in active date ending ≤60s | User F waiting | Orchestrator plans reservation (not immediate pair) |
| E finishes → both waiting | Commit window | `pair_reservations` → `speed_dates` |

**Dev:** `SpeedSparkMatchingDev.seedActiveDatesEndingSoon()` · `printOrchestrationReport(windowId)`

**Result:** ☐ ✅ ❌

### MT-6 Missing data neutral score

| Setup | Expected |
|-------|----------|
| User with empty `lifestyleTags` | `lifestyleFit = 50`, not 0 |
| No prior appearance feedback | `appearanceFit = 50` |

**Result:** ☐ ✅ ❌

### MT-7 Block / report in matching context

| Setup | Expected |
|-------|----------|
| A reported B in window | Pair blocked in `get_window_matching_context` |
| A blocked B | Pair never formed |

**Result:** ☐ ✅ ❌

---

## 6. Mobile tests

### 6.1 Platform matrix

| Platform | Build type | Voice | Pairing | Priority |
|----------|------------|-------|---------|----------|
| **Web (Chrome)** | `npm run web` | ✅ LiveKit | ✅ | P0 — fastest QA |
| **Web (Safari)** | Same | ⚠️ mic permissions | ✅ | P1 |
| **iOS Simulator** | `npm run ios` or EAS simulator | ❌ Expo Go / limited | ✅ | P2 — UI + flow |
| **iOS device** | EAS dev build | ✅ | ✅ | **P0** for voice |
| **Android device** | EAS dev build | ✅ | ✅ | **P0** for voice |
| **Expo Go** | QR from `npm start` | ❌ | ✅ | Flow-only, not voice beta |

### 6.2 iOS simulator checklist

- [ ] Cold start → correct onboarding route (new vs returning user)
- [ ] Safe area: notch/Dynamic Island — timer and controls not clipped
- [ ] Keyboard: Auth, Profile Creation, Messages input — not obscured
- [ ] Photo picker opens (library)
- [ ] Location picker works
- [ ] Lobby scroll + queue panel layout

### 6.3 Android dev build checklist

- [ ] APK installs (unknown sources enabled)
- [ ] Dev client connects to Metro (`npm run start:dev`)
- [ ] Mic permission prompt on ActiveDate
- [ ] Camera permission for profile photos + local preview
- [ ] Back button behavior (lobby, messages, settings)
- [ ] Audio routing (speaker / earpiece) — UI toggle present (Phase 1 voice)

### 6.4 Permissions

| Permission | Screen | Pass criteria |
|------------|--------|---------------|
| Microphone | ActiveDate | Deny → banner; Allow → can join voice |
| Camera | ActiveDate / Profile | Local preview works |
| Photos | Manage Profile | Upload succeeds |
| Location | Profile Creation | City populates |

### 6.5 Photo upload

- [ ] JPEG/PNG under 5 MB uploads
- [ ] Over-limit file shows error (if enforced client-side)
- [ ] Photo order / delete syncs after save
- [ ] Public URL loads on second device

### 6.6 ActiveDate safe areas

- [ ] LIVE pill + timer visible on small phones
- [ ] Draggable PiP does not render off-screen
- [ ] End date / Report / Block reachable without overlap
- [ ] Modals (end confirm, block, report) centered and dismissible

---

## 7. Pass/fail criteria

### 7.1 Must pass before inviting testers (P0)

| ID | Criterion |
|----|-----------|
| P0-1 | Migrations **001–015** applied without error |
| P0-2 | Realtime enabled on all 5 tables |
| P0-3 | `pair-live-windows` deployed; cron **or** documented pairing plan for beta window |
| P0-4 | LiveKit secrets set; `create-call-room` + `get-call-token` deployed |
| P0-5 | Internal dry run: **HP-1 through HP-10** pass once (voice on web or dev build) |
| P0-6 | **FC-1** (no-show) and **FC-4** (block) pass |
| P0-7 | Report + deletion request create correct DB rows |
| P0-8 | Tester comms state: **voice dates are real; partner video is still placeholder** |
| P0-9 | Moderation owner assigned; reports reviewed within 24h |
| P0-10 | Live window seeded for beta night |

### 7.2 Should pass (P1 — fix or document workaround)

| ID | Criterion |
|----|-----------|
| P1-1 | **FC-2** reconnect behavior acceptable |
| P1-2 | **MT-1–MT-4** matching tests pass in dev console |
| P1-3 | Photo upload on iOS + Android dev builds |
| P1-4 | `EXPO_PUBLIC_PAIRING_INVOKE_SECRET` on all tester builds |
| P1-5 | DateQueue re-join: **workaround documented** (“return to lobby and join queue again”) |

### 7.3 Known beta limitations (acceptable if disclosed)

| Limitation | Tester messaging |
|------------|------------------|
| Partner video is placeholder | “Voice is live; video pane is not your partner’s camera yet.” |
| Identity verification is tap-through | “ID check is not enforced in beta.” |
| No push notifications | “Open the app during the scheduled window.” |
| DateQueue “Join next date” may not re-enter queue | “Use lobby Join queue for your next date.” |
| Unmatch is client-only | Match row remains in DB |
| Dev timer 60s vs prod 5 min | Internal builds only |
| Account deletion is request-only | Auth user not auto-deleted |
| Expo Go cannot test voice | Use web or EAS dev build |
| Safari background suspends media | Prefer Chrome or native |
| Lobby stats / unread counts may be mock | Do not trust badge numbers for QA |
| Text notifications toggle may not persist | Known partial feature |

### 7.4 No-go blockers

Stop beta if any occur:

| ID | Blocker |
|----|---------|
| NG-1 | Pairing never creates `speed_dates` with two waiting users (and cron/worker confirmed running) |
| NG-2 | Feedback RPC fails or mutual match never creates `matches` |
| NG-3 | Messages fail RLS for matched participants |
| NG-4 | Sign-up or onboarding cannot complete |
| NG-5 | Marketing promises **live video dating** to testers |
| NG-6 | No moderator available during beta window |
| NG-7 | LiveKit voice fails on **both** web and dev build (core value untestable) |

---

## 8. Bug report template

Copy into Discord / Linear / GitHub Issues / shared form.

```markdown
## Title
[Platform] Short description — e.g. "iOS: Timer starts before partner joins"

## Severity
- [ ] P0 — Blocker (cannot complete core flow)
- [ ] P1 — Major (workaround exists)
- [ ] P2 — Minor / cosmetic
- [ ] P3 — Enhancement

## Environment
- **Platform:** iOS / Android / Web (browser)
- **Build:** Expo Go / EAS dev build / web dev server / production
- **App version / commit:** 
- **Supabase project:** (staging / prod — no secrets)
- **Date/time (timezone):**

## Test accounts
- **User A email (last 4 chars ok):** 
- **User B email:** 
- **Window ID (if known):** 
- **Speed date ID (if known):** 

## Steps to reproduce
1. 
2. 
3. 

## Expected behavior


## Actual behavior


## Screenshots / screen recording
(attach)

## Logs
- Metro / browser console snippets (redact tokens)
- Relevant `[SpeedSpark Backend]` lines, e.g.:
  - `call.both.joined`
  - `call.no_show.cancelled`
  - `pairing.*`

## Supabase rows to inspect
| Table | Filter | What to check |
|-------|--------|---------------|
| `queue_entries` | `user_id`, `window_id` | `status`, `joined_at` |
| `speed_dates` | `id` | `status`, `user_a_id`, `user_b_id` |
| `speed_date_calls` | `speed_date_id` | `status`, `both_joined_at`, `cancel_reason` |
| `date_feedback` | `speed_date_id` | both raters submitted |
| `matches` | participants | row exists on mutual yes |
| `messages` | `match_id` | delivery |
| `reports` | `reporter_id` | `context`, `status` |
| `blocked_users` | `blocker_id` | block recorded |
| `pairing_run_logs` | recent | `details` jsonb |
| `profiles` | `id` | `account_status` |

## Repro rate
- [ ] Always  [ ] Sometimes  [ ] Once

## Workaround (if any)

```

---

## 9. Recommended beta readiness score

### Scorecard (honest assessment as of 2026-06-02)

| Area | Score | Notes |
|------|-------|-------|
| Auth + onboarding | **85%** | Email path solid; phone OTP optional |
| Profile + photos | **80%** | Upload pipeline exists; verify on all platforms |
| Queue + pairing | **75%** | Server pairing + worker; **ops-dependent** (cron) |
| Voice calls (LiveKit) | **70%** | Phase 1 + Phase 5 orchestration; needs real-device soak |
| Video | **15%** | Placeholder UI only |
| Feedback + matches | **90%** | RPCs proven |
| Messaging | **85%** | Realtime; no push |
| Safety (block/report/delete) | **80%** | Wired; admin manual |
| Multi-date session UX | **60%** | DateQueue re-join gap |
| Mobile build readiness | **75%** | EAS configured; first build must be verified |

**Overall closed-beta readiness: ~72%**

### Recommendation

| Beta type | Verdict | Conditions |
|-----------|---------|------------|
| **Flow beta** (matching → voice date → feedback → chat) | **CONDITIONAL GO** | P0 checklist complete; voice tested on web + ≥1 native dev build; testers informed about placeholder video |
| **Voice-first closed beta** | **CONDITIONAL GO** | Above + FC-1 no-show verified + LiveKit secrets stable |
| **“Video speed dating” marketing beta** | **NO-GO** | Partner video not implemented |
| **Expo Go-only distribution** | **NO-GO** | LiveKit requires dev build or web |

### Final GO / NO-GO

> **CONDITIONAL GO** for a **closed beta of 10–20 informed testers** focused on **matching, voice dates, feedback, mutual matches, messaging, and safety** — provided the P0 checklist (§7.1) passes on staging/production Supabase **and** at least one internal pair completes HP-1–HP-10 including LiveKit voice on a non–Expo Go build.
>
> **NO-GO** if pairing cannot run unattended during the window, if voice fails end-to-end, or if external messaging promises full video dating.

---

## Bug bash schedule (suggested)

| Session | Focus | Duration |
|---------|-------|----------|
| **Day 1 — Internal** | §3 Happy path HP-1–HP-10 | 2h |
| **Day 2 — Internal** | §4 Failure cases FC-1–FC-8 | 2h |
| **Day 3 — Internal** | §5 Matching + §6 Mobile matrix | 2h |
| **Day 4 — Beta testers** | Happy path + free exploration | 90 min window |
| **Day 5 — Triage** | P0/P1 from §8 templates | — |

---

## Quick reference — dev console commands

```javascript
// Matching
await SpeedSparkMatchingDev.runMatchingFrameworkTests()
await SpeedSparkMatchingDev.testWaitPolicy()
await SpeedSparkMatchingDev.compareDevMatchScores('userA-uuid', 'userB-uuid')

// Pairing / orchestration
await SpeedSparkMatchingDev.seedDevLiveWindow()
await SpeedSparkMatchingDev.runDevPairing('window-uuid')
await SpeedSparkMatchingDev.printOrchestrationReport('window-uuid')
await SpeedSparkMatchingDev.printReservationMetrics('window-uuid')

// Call orchestration
await SpeedSparkMatchingDev.testCallOrchestration()
```

---

## Related docs

- [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) — ops setup + go/no-go
- [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md) — voice E2E
- [EAS_BUILD_READINESS.md](./EAS_BUILD_READINESS.md) — native builds
- [MODERATION.md](./MODERATION.md) — report triage
- [supabase/README.md](../supabase/README.md) — migrations + Edge Functions

---

*Re-run P0 checks after any migration, Edge Function, or call-orchestration change.*
