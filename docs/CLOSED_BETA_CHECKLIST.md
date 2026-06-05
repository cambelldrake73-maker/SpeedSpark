# SpeedSpark — Closed beta launch checklist

**Purpose:** Decide if SpeedSpark is ready for 10–20 invited testers and what blocks you next.  
**Sources:** [PROJECT_INVENTORY.md](./PROJECT_INVENTORY.md) · [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md) · [supabase/README.md](../supabase/README.md)

**Last updated:** 2026-06-02

> **Note:** `PROJECT_INVENTORY.md` §10–§12 predates migrations 006–009. This checklist reflects **actual codebase state** where they differ (photos, server pairing, reports, account deletion).

---

## Executive summary

| Question | Answer |
|----------|--------|
| Ready for a **flow beta** (onboarding → pair → timed date → feedback → match → chat)? | **Yes, if** Supabase + Edge Function + Realtime are configured and you accept placeholder video. |
| Ready to market as **voice/video speed dating**? | **No.** Partner video/audio is mock. See [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md). |
| Biggest operational blocker | Pairing depends on deployed `pair-live-windows` Edge Function + cron (or at least one logged-in user triggering the 15s worker). |
| Biggest product blocker after ops | No real call between matched users. |
| Biggest UX blocker in multi-date sessions | `DateQueue` does not call `joinQueue()` after “Join next date” — users can get stuck waiting. |

---

## 1. Current working functionality

Status key: **Works** = end-to-end with Supabase configured · **Partial** = works with gaps · **Mock** = UI only / demo mode

| Area | Status | What works | Gaps |
|------|--------|------------|------|
| **Auth** | Partial | Email sign-up/sign-in, session persist, cold-start hydrate | Phone/OTP is demo-only; Supabase path skips `ContactVerification` |
| **Profiles** | Works | Onboarding save → `profiles`; cold-start hydrate | `queerRoles` saved as `[]`; ManageProfile saves to server |
| **Photos** | Partial | Upload/sync via `profilePhotos.ts`, bucket `profile-photos`, optional on onboarding | Max 5 MB; no image moderation; demo mode still local-only |
| **Preferences** | Works | Save/load `dating_preferences` incl. `matching_priority_order` | `preferredQueerRoles` always `[]`; no gender hard filter |
| **Queue** | Works | Join/leave → `queue_entries`; lobby counts + Realtime | `DateQueue` re-join from MatchResult is **broken** (no-op) |
| **Pairing** | Partial | Server-side via `pair-live-windows` Edge Function + `get_window_matching_context` RPC; in-app worker every 15s | Requires deploy + secrets + cron for 24/7; dev fallback `SpeedSparkMatchingDev.runDevPairing()` |
| **Active dates** | Partial | Realtime pair → `ActiveDate`; 5-min timer (60s dev); end → feedback; block/report wired | **No partner video/audio**; controls are UI-only; “Connected” = permissions, not call |
| **Feedback** | Works | `submit_date_feedback_and_resolve` RPC → `date_feedback` | Partner profile fallback if context cleared |
| **Matches** | Works | Mutual yes → `matches` row; MatchResult realtime/poll | Unmatch is client-only |
| **Messaging** | Works | List, thread, send, Realtime INSERT | No push, read receipts, media, typing |
| **Blocking / reporting** | Works | `blocked_users`; `reports` from ActiveDate + Messages; block cancels active date | Admin triage manual ([MODERATION.md](./MODERATION.md)) |
| **Account safety** | Partial | `account_status`, deletion request RPC, inactive users blocked from queue/messages | Auth user not purged; suspension is manual in Table Editor |

**Demo mode (no `.env`):** Full UI walkthrough with mocks — not valid for closed beta.

---

## 2. Required Supabase setup

### Migrations (run in order, SQL Editor)

- [ ] `001_initial_schema.sql`
- [ ] `002_matching_queue_rpc.sql`
- [ ] `003_feedback_match_rpc.sql`
- [ ] `004_messages_match_update.sql`
- [ ] `005_matching_priority_order.sql`
- [ ] `006_auto_pairing.sql`
- [ ] `007_server_pairing.sql`
- [ ] `008_profile_photos_storage.sql`
- [ ] `009_account_safety.sql`

### Edge functions

- [ ] Deploy `supabase/functions/pair-live-windows`
- [ ] Set secret: `PAIRING_CRON_SECRET` (random string)
- [ ] Schedule cron (recommended: every 1 min minimum; 15s if dashboard supports it)
- [ ] Smoke-test invoke:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/pair-live-windows" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "x-pairing-secret: YOUR_SECRET"
```

- [ ] Confirm rows in `pairing_run_logs` after two users are waiting

### Secrets (Supabase + app)

| Secret / env | Where | Required |
|--------------|-------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | App `.env` | Yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | App `.env` | Yes |
| `EXPO_PUBLIC_PAIRING_INVOKE_SECRET` | App `.env` | Yes (must match `PAIRING_CRON_SECRET`) |
| `PAIRING_CRON_SECRET` | Edge Function secrets | Yes |
| Service role key | Edge Function runtime only | Auto (Supabase) — **never in app** |

### Realtime tables

Enable in **Database → Replication**:

- [ ] `queue_entries`
- [ ] `speed_dates`
- [ ] `date_feedback`
- [ ] `matches`
- [ ] `messages`

Without Realtime: pair detection and chat lag or fail (MatchResult polls every 3s as fallback).

### Storage bucket

- [ ] Bucket `profile-photos` exists (migration 008 idempotent)
- [ ] Policies: public read, user-scoped write `{userId}/…`
- [ ] Test upload from Manage Profile → file visible in Storage + `profile_photos` row

### RLS checks (manual, before inviting testers)

Run as two test users in Table Editor or SQL:

- [ ] User A cannot read User B's `dating_preferences` (expected — server pairing uses service role)
- [ ] User A cannot read all `reports` — only own
- [ ] Blocked user B hidden from A's profile SELECT
- [ ] `deleted_request` / `suspended` user cannot join queue (app throws) and cannot log in hydrate path
- [ ] Only speed date **participants** can update their `speed_dates` row
- [ ] Only match **participants** can insert/read `messages`

### Auth settings

- [ ] Email provider enabled
- [ ] For beta: consider **disable email confirm** to reduce signup friction (re-enable for production)
- [ ] Document test account policy (no real PII requirement vs. real emails)

### Seed data

- [ ] At least one **live** row in `speed_date_windows` during beta window  
  Dev: `await globalThis.SpeedSparkMatchingDev.seedDevLiveWindow()`
- [ ] Window `start_time` / `end_time` / `is_live` correct for tester timezone

---

## 3. Required local / dev setup

### Environment variables

```bash
cp .env.example .env
```

| Variable | Required for beta |
|----------|-------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `EXPO_PUBLIC_PAIRING_INVOKE_SECRET` | Yes |

Restart Expo after any `.env` change.

### Expo commands

```bash
npm install
npm start          # dev server — press i / a / w
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # browser (camera/mic via getUserMedia)
```

**Expo Go:** OK for this beta (no WebRTC SDK yet). Future video milestone will require **EAS dev builds** — not Expo Go.

### GitHub workflow

**None exists in repo today.** For closed beta you can ship without CI, but minimally:

- [ ] Private repo or clear contributor access
- [ ] `.env` in `.gitignore` (never commit secrets)
- [ ] Tag a release commit for beta build (`git tag beta-0.1.0`)
- [ ] Optional later: GitHub Action for `tsc --noEmit` on PR

No GitHub workflow is a **should have**, not a must-have, for 10–20 testers.

### Tester distribution

Choose one:

- [ ] **Web:** share Expo web URL or deployed static host (simplest for 10–20)
- [ ] **Native:** Expo Go + QR from `npm start` (same Wi‑Fi / tunnel)
- [ ] **TestFlight / internal APK:** not required for first closed beta unless you need native-only behavior

Document for testers: Supabase email signup only, no phone login, video is placeholder.

---

## 4. Required before inviting 10–20 testers

### Must have

- [ ] All migrations **001–009** applied
- [ ] Realtime enabled on 5 tables
- [ ] `pair-live-windows` deployed with cron **or** confirmed pairing works with testers keeping app open in lobby
- [ ] Live speed date window seeded for beta night
- [ ] Two internal accounts: full flow signup → queue → pair → date → feedback → mutual match → message **passes once**
- [ ] Block + report tested once; row visible in Supabase
- [ ] Deletion request tested once; user signed out + `account_status = deleted_request`
- [ ] Written tester brief: **“Video is not live yet — you’re testing matching, timing, feedback, chat, and safety.”**
- [ ] Moderation contact: who reviews `reports` in Table Editor ([MODERATION.md](./MODERATION.md))
- [ ] Supabase project on paid/free tier with headroom; billing alert set

### Should have

- [ ] Fix or workaround **DateQueue re-join** (document: “return to lobby and join queue again” until fixed)
- [ ] `EXPO_PUBLIC_PAIRING_INVOKE_SECRET` set on all tester builds
- [ ] Email confirm disabled or testers know to check spam
- [ ] 2+ moderators briefed on suspend/delete in `profiles`
- [ ] Feedback channel (Discord / form) for tester bugs
- [ ] Known-issues doc shared with testers

### Can wait

- [ ] Real voice/video (LiveKit — see VIDEO_INTEGRATION_PLAN)
- [ ] Identity verification vendor
- [ ] Push / SMS notifications
- [ ] Unmatch in database
- [ ] Real lobby stats / unread counts
- [ ] Text notifications toggle persisted to DB
- [ ] Phone auth
- [ ] Admin dashboard UI
- [ ] GitHub CI/CD
- [ ] TestFlight production build
- [ ] Deep links
- [ ] GDPR export / auth user hard delete

---

## 5. Known limitations

Be explicit with testers and stakeholders.

| Limitation | Impact |
|------------|--------|
| **Video is placeholder** | Partner pane is static UI; mute/video/speaker don't affect a real call. Local camera only via `expo-camera`. Not a video dating product yet. |
| **Identity verification is placeholder** | Window/onboarding verification is tap-through; no selfie vendor; `verification_status` not meaningfully enforced. |
| **Pairing interval / ops** | Client worker fires every **15s** when app open; **24/7 pairing needs Edge Function cron**. If cron fails, queue stalls unless someone runs dev pairing. |
| **Admin review is manual** | Reports reviewed in Supabase Table Editor; no in-app admin. |
| **Push notifications not implemented** | No “window going live” alerts; testers must open app during scheduled window. |
| **DateQueue re-join broken** | After a date, “Join next date” may not re-enter queue — use lobby join as workaround. |
| **Unmatch** | Removes match from local list only; row remains in DB. |
| **Demo mode** | Without `.env`, everything is mock — do not use for beta. |
| **Dev timer** | `__DEV__` builds use **60s** dates, not 5 minutes. Production builds use 300s. |
| **Web vs native** | Web works but Safari backgrounding kills media; prefer native for future video beta. |

---

## 6. Test plan

Run with **two Supabase test accounts** (A and B) on production-like builds (`.env` set, not demo mode).

### 6.1 New user signup

1. Open app → Welcome → Sign up.
2. Email + password → submit.
3. **Expect:** Account created; routed to Profile Creation (or correct onboarding step).
4. **Verify:** `auth.users` + `profiles` row in Supabase.

### 6.2 Profile creation

1. Fill name, age, location, height, identity, tags.
2. Continue.
3. **Expect:** Row updated in `profiles`; navigates to Preferences.
4. **Verify:** `profiles` columns match input.

### 6.3 Photo upload

1. On Profile Creation (optional photos) or Settings → Manage profile.
2. Add 1–3 photos from library.
3. Save.
4. **Expect:** Files in Storage `profile-photos/{userId}/…`; rows in `profile_photos`.
5. Kill and reopen app — photos still on profile.

### 6.4 Preferences save

1. Set age range, distance, dealbreakers, priority order.
2. Continue through Verification (placeholder) → complete onboarding.
3. **Expect:** `dating_preferences` row; `profiles.onboarded_at` set.
4. **Verify:** Land on Speed Date Lobby.

### 6.5 Join queue

1. Confirm a **live window** shows in lobby.
2. Tap join queue on User A and User B (two devices or web + native).
3. **Expect:** `queue_entries.status = waiting` for both.
4. **Verify:** Lobby count updates (Realtime).

### 6.6 Automatic pairing

1. Wait ≤30s (15s worker + cron latency).
2. **Expect:** Both users navigate to Active Date with real `speedDateId`.
3. **Verify:** `speed_dates` row `status = active`; `queue_entries.status = paired`; optional `pairing_run_logs` entry.

**Fallback if stuck:** `SpeedSparkMatchingDev.runDevPairing(windowId)` in dev console — note failure in beta log if needed.

### 6.7 Active date flow

1. Grant camera/mic if prompted.
2. Confirm timer running (60s dev / 300s prod).
3. Let timer expire OR tap End date early.
4. **Expect:** Navigate to Post-Date Feedback; `speed_dates.status = completed`.
5. **Note:** Partner video remains placeholder — confirm testers understand.

### 6.8 Feedback

1. User A: rate + Yes/No → submit.
2. **Expect:** Match Result “waiting” if B not submitted.
3. User B: rate + Yes/No → submit.
4. **Verify:** Two rows in `date_feedback`.

### 6.9 Mutual match

1. Both submit **Yes**.
2. **Expect:** Match Result shows mutual match; `matches` row created.
3. Tap **Send a message** → opens Messages with real `matchId`.

### 6.10 Messaging

1. User A sends message.
2. **Expect:** Row in `messages`; User B sees it (Realtime or refresh).
3. User B replies.
4. **Verify:** `matches.last_message_at` updates.

### 6.11 Block / report

**Report (Messages):**

1. Open chat menu → Report.
2. **Verify:** `reports` row `context = messages`, `status = pending`.

**Block (Active Date or Messages):**

1. Block partner during or after date.
2. **Verify:** `blocked_users` row; if during date, `speed_dates.status = cancelled`.
3. Re-queue both — **expect:** pairing engine skips blocked pair.

### 6.12 Delete account request

1. Settings → Delete account → confirm.
2. **Expect:** Signed out to Welcome; `profiles.account_status = deleted_request`.
3. Attempt sign-in — **expect:** hydrate error / cannot participate (inactive account).

---

## 7. Go / no-go criteria

### GO — closed beta may start when ALL pass

| # | Criterion |
|---|-----------|
| G1 | Migrations 001–009 applied; no SQL errors |
| G2 | Realtime enabled; pair detection works without manual `runDevPairing` in a dry run |
| G3 | Edge Function deployed; cron OR documented plan for pairing during beta window |
| G4 | Two internal testers complete §6.1–§6.10 in one session without developer intervention |
| G5 | Report + block + deletion request verified in database |
| G6 | Tester comms explicitly state **no live partner video/audio** |
| G7 | Moderation owner assigned for beta window |
| G8 | Live window scheduled and seeded |

### NO-GO — stop or fix first

| # | Blocker |
|---|---------|
| N1 | Pairing never creates `speed_dates` with two waiting users |
| N2 | Feedback RPC fails or mutual match never creates `matches` |
| N3 | Messages fail RLS for matched users |
| N4 | Sign-up or onboarding cannot complete |
| N5 | You intend to advertise “live video dates” to testers |
| N6 | No one available to review reports within 24h during beta |

### Conditional GO

You may run a **“flow beta”** (GO with G1–G4, G6–G8) while labeling the product **“speed date flow preview”** — not **“video dating beta.”** That matches current architecture per [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md).

---

## 8. Recommended next coding milestone

### Build next: **LiveKit Phase 1 — voice-only call POC**

**One milestone. Not video UI redesign. Not a migration sprint.**

Implement from [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md) §8 Phase 1:

1. EAS development build (Expo Go insufficient)
2. `speed_date_calls` migration + `get-call-token` / `create-call-room` Edge Functions
3. `useSpeedDateCall` hook — **audio only** first
4. Wire into existing `ActiveDateScreen` internals; **no layout changes**
5. Replace misleading “Connected” chip with real connection state

**Why this and not something else**

| Alternative | Why deprioritized |
|-------------|-------------------|
| Fix DateQueue re-join | Small fix (~hours); do before beta night but not the strategic milestone |
| Deploy pairing cron only | **Ops task**, not code — belongs in §2 checklist |
| Admin dashboard | Manual Table Editor is enough for 10–20 users |
| Push notifications | Important for growth; doesn't unblock core product truth |
| Identity verification vendor | Placeholder acceptable for closed beta with informed testers |

**Why voice-first LiveKit beats jumping to full video**

- Validates the hardest integration (dev builds, tokens, permissions, teardown) with less UI risk.
- Closed beta without *any* real audio makes the core value prop untestable — feedback on “did you feel a connection?” is meaningless.
- Plan already scoped; avoids native WebRTC operational cost.

**After Phase 1 succeeds:** Phase 2 video tracks into existing `PartnerVideoPane` / PiP — still no redesign.

---

## Quick reference — beta night runbook

1. Confirm live window in `speed_date_windows`
2. Confirm Edge Function cron healthy (`pairing_run_logs` updating)
3. Post tester link + “no live video yet” disclaimer
4. Monitor `queue_entries`, `speed_dates`, `reports`
5. After window: review reports; suspend bad actors via `profiles.account_status`
6. Collect feedback on: pairing speed, date length, match quality, chat, safety UX

---

## Related docs

- [PROJECT_INVENTORY.md](./PROJECT_INVENTORY.md) — full feature inventory (partially pre-006/009)
- [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md) — video/voice roadmap
- [MODERATION.md](./MODERATION.md) — report review
- [supabase/README.md](../supabase/README.md) — setup and pairing ops
