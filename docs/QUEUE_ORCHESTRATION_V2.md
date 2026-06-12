# SpeedSpark Queue Orchestration v2

**Status:** Phase 5 implemented (LiveKit call orchestration)  
**Principle:** Plan early, commit late  
**Last updated:** 2026-06-02

**Related docs:** [MATCHING_FRAMEWORK.md](./MATCHING_FRAMEWORK.md) · [PROJECT_INVENTORY.md](./PROJECT_INVENTORY.md) · [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) · [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md)

**Non-goals for this document:** UI redesign, onboarding changes, new matching categories, ranking changes, or frontend layout changes. Queue orchestration builds **on top of** the existing v1 matching framework (`matchingService.ts`, `pairingEngine.ts`).

---

## Executive summary

Today, pairing only considers users with `queue_entries.status = 'waiting'`. Users on active dates are invisible until they finish feedback and re-join the queue — creating idle time between dates.

**Queue Orchestration v2** introduces:

1. An **Available Soon** candidate pool (active dates ending within 60 seconds) for **planning only**
2. **Pre-match reservations** — temporary holds on a likely next pair, not a `speed_dates` row
3. **Late commit** — create `speed_dates` only when both users are actually available
4. **Wait-time intelligence** — relax *soft-score* thresholds over time, never hard gates
5. **Call orchestration** — room/token readiness before navigation; timer starts when both join

---

## 1. Queue lifecycle

End-to-end member journey through the queue system:

```
Waiting
   ↓
Reserved          ← new (pre-match hold; not yet paired)
   ↓
Paired            ← queue_entries.status = 'paired'
   ↓
Active Date       ← speed_dates.status = 'active'
   ↓
Feedback          ← PostDateFeedback (client); speed_dates → completed
   ↓
Available Again   ← eligible to match next (waiting or available-soon)
```

### State definitions

| State | DB / signal | Pairing engine | Client navigation |
|-------|-------------|----------------|-------------------|
| **Waiting** | `queue_entries.status = 'waiting'` | Eligible for **commit** (immediate pair) | Lobby / DateQueue searching |
| **Reserved** | `pair_reservations.status = 'pending'` | Eligible for **planning** only; blocks other reservations for those users | **No change** — user still on active date or feedback |
| **Paired** | `queue_entries.status = 'paired'` | Removed from candidate pool | Realtime `speed_dates` INSERT → ActiveDate (today) |
| **Active Date** | `speed_dates.status = 'active'` | In **Available Soon** pool when ≤60s remain | ActiveDate screen |
| **Feedback** | `speed_dates.status = 'completed'` (after end); feedback RPC pending | Not in waiting pool until re-join / auto-return | PostDateFeedback → MatchResult |
| **Available Again** | `waiting` OR (active date ending ≤60s) | Waiting → commit; ending-soon → plan only | DateQueue / lobby |

### Current vs v2

| Today (`001` schema) | v2 addition |
|----------------------|-------------|
| `queue_entries`: `waiting`, `paired`, `left` | Optional `reserved` on queue row **or** separate reservation table (recommended) |
| Pairing input: `waiting` only | Candidate pool: `waiting` + **available soon** |
| Commit: `apply_queue_pair` immediately | Commit: validate reservation → `apply_queue_pair` |

---

## 2. Available Soon pool (Phase 2 — implemented)

### Current behavior (immediate pairing)

`pairingEngine.runPairingForWindow` still loads the extended RPC but **filters to `waiting` only** before calling `apply_queue_pair`.

### v2 candidate pool (reservation planning)

```
Candidate Pool (for scoring & reservations)
├── Waiting users          → eligible for commit AND reservation
└── Available Soon users   → eligible for reservation ONLY
```

**Available Soon** definition (enforced in `014_available_soon_pool.sql`):

- User has `speed_dates.status = 'active'` for the current window
- `speed_date_duration_seconds() - elapsed ≤ 60` (`available_soon_threshold_seconds()`)
- `profiles.account_status = 'active'`
- User has **not** blocked or reported their **current date partner**
- User has **no** pending reservation in this window
- User has **no** other active speed date
- User is **not** also in the waiting queue (deduplicated — waiting wins)

Each available-soon entry includes `speedDateId`, `secondsUntilAvailable`, and `currentPartnerId` (excluded from pairing with that partner).

**Not eligible for actual pairing yet** until:

- Active date ends (`completed` or `cancelled`)
- Feedback flow completes (or skip policy defined — see commit logic)
- Queue row returns to `waiting` (or commit RPC sets `paired` atomically)

### Why 60 seconds?

- Aligns with production date length (300s) and dev (60s) in `DATE_DURATION_SECONDS`
- Gives orchestrator 1–2 pairing worker ticks (15s client worker / 60s cron) to finalize reservation
- Short enough to limit stale plans if user ends early or blocks

### Planning vs committing

| Action | Waiting user | Available Soon user |
|--------|--------------|---------------------|
| Score pair (v1 framework) | Yes | Yes |
| Create reservation | Yes | Yes |
| Call `apply_queue_pair` | Yes | **No** |
| Create call room / token | **No** (until commit) | **No** |
| Navigate to ActiveDate | **No** (until commit) | **No** |

---

## 3. Pre-match reservation

### Concept

A **reservation** means: *“We intend to match user A and user B next in this window.”*

It is **NOT**:

- A `speed_dates` row
- A LiveKit / Daily / WebRTC room
- A navigation event
- A mutual match (`matches` table)

### Reservation lifecycle

```
reserve     Orchestrator picks best pair; insert pending reservation
   ↓
hold        TTL active; users blocked from competing reservations
   ↓
commit      Both available → commit_pair_reservation → speed_date → (Phase 5: call room)
   OR
expire      TTL elapsed, block/report, or hard-gate failure → release hold
   OR
cancelled   User leaves queue, window ends, account suspended
```

### Why reservations help

**Without reservation:**

```
Date ends → Feedback → Re-join queue → Wait for pairing tick → Pair → Call setup → ActiveDate
         └────────────── often 30s–3min dead time ──────────────┘
```

**With reservation:**

```
Date ending (≤60s) → System scores pool → Reservation held
Feedback (short)     → Commit reservation → Pair + room ready → ActiveDate
         └──────── next match often immediate ────────┘
```

### Reservation rules

1. A user may appear in **at most one** pending reservation per window
2. Reservations expire (recommended TTL: **90 seconds** from creation, or at window end)
3. Re-scoring on commit must re-run **hard gates** (blocks, reports, gender, distance, account status)
4. Soft scores use **pre-feedback profile state** — do not wait for current date’s attractiveness rating (see §6)

---

## 4. Small pool strategy

Orchestrator should branch on **planning pool size** (waiting + available soon, deduplicated):

| Pool size | Behavior |
|-----------|----------|
| **2 users** | If hard gates pass, **commit immediately** (or reserve + commit on next tick if either available-soon). No need for greedy matrix. |
| **3–5 users** | Enumerate all valid pairs; score with v1 mutual fit; **hold single best reservation** (highest mutual score). Avoid chaining reservations. |
| **6–20 users** | Current approach: full compatibility matrix → greedy max-weight matching → top pairs become reservations or commits depending on availability |
| **20+ users** | **Unchanged** v1 framework: `evaluateCompatibilityMatrix` + greedy pairing in `pairingEngine.ts` |

Small-pool logic runs **inside** the orchestrator layer; `matchingService.ts` stays unchanged.

---

## 5. Wait-time intelligence (Phase 4 — implemented)

Track **wait time** per user: `now() - queue_entries.joined_at` for `waiting` users. Available-soon users use queue `joined_at` when present, otherwise default to 90s (normal bucket).

### Pair-level threshold rule

After hard gates and mutual scoring, `shouldAcceptPair()` applies a **minimum mutual score** based on:

- **Wait bucket** from `max(waitA, waitB)` — the longer-waiting user relaxes the floor for the pair
- **Pool bucket** from total planning pool size (waiting + available-soon)

Hard gates in `matchingService.ts` are unchanged — wait policy only filters already-compatible pairs.

### Wait buckets

| Bucket | Wait time |
|--------|-----------|
| `fresh` | 0–60s |
| `normal` | 60–180s |
| `long` | 180–300s |
| `extended` | 300s+ |

### Pool buckets

| Bucket | Pool size |
|--------|-----------|
| `tiny` | 2–3 |
| `small` | 4–5 |
| `medium` | 6–20 |
| `large` | 21+ |

### Minimum mutual score matrix

| wait \\ pool | tiny | small | medium | large |
|--------------|------|-------|--------|-------|
| fresh | 60 | 60 | 65 | 70 |
| normal | 55 | 55 | 60 | 65 |
| long | 45 | 48 | 50 | 55 |
| extended | 40 | 42 | 45 | 50 |

Absolute floor: **40** (never accept below). Default reference for metrics: **50** (neutral score).

**Why small pools need lower thresholds:** With 2–3 people, strict floors cause unnecessary idle time; hard gates still protect safety and stated preferences.

### Metrics logged (`pairing_run_logs.details`)

`waitBucket`, `poolBucket`, `minimumScoreApplied`, `rejectedBelowThresholdCount`, `acceptedBelowDefaultThresholdCount`

### Never relax (hard gates)

These remain **absolute** at all wait times:

- `preferredLookingFor` (bidirectional gender gate)
- Age range hard gate (if enforced separately from soft `ageFit`)
- `maxDistanceMiles`
- Blocks (`blocked_users`)
- Reports (pair keys in window context)
- `account_status = 'active'`
- Recent repeat date cooldown
- Same-user / duplicate pair

Wait-time policy adjusts **which reservation is chosen** or **minimum mutual score to commit**, not safety or stated preferences.

Implementation note: pass `waitPolicy` into orchestrator only; do not fork `scoreCategory()` functions.

---

## 6. Reservation scoring

Use **existing v1 matching** without modification:

- `collectHardBlockers` / `evaluateCompatibility`
- `matchingPriorityOrder` weights
- `scoreMutualFit`
- Appearance scores from **prior** `date_feedback` only (via `fetchAppearanceFitScores`)

### Do NOT use current-date feedback for planning

The attractiveness rating from the **in-progress or just-finished** date is useful for **future** learning but must **not** block reservation planning:

- User A is still on a date with B → A→C appearance score for C should use historical data only
- After feedback submits, next pairing run may include new A→B rating for **subsequent** windows

Document explicitly: **reservation tick uses snapshot at plan time**; **commit tick re-validates** hard gates and may refresh appearance map if feedback landed between plan and commit.

---

## 7. Backend design — reservation storage

### Implemented: migration `013_pair_reservations.sql`

See `supabase/migrations/013_pair_reservations.sql` (filename is **013** because `011_contact_verification.sql` already exists).

```sql
-- Implemented in 013_pair_reservations.sql

create table public.pair_reservations (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.speed_date_windows (id) on delete cascade,
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'committed', 'expired', 'cancelled')),
  mutual_score numeric,
  plan_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  committed_at timestamptz,
  speed_date_id uuid references public.speed_dates (id) on delete set null,
  check (user_a_id <> user_b_id)
);
```

**RPCs (service_role only):**

| RPC | Purpose |
|-----|---------|
| `create_pair_reservation(...)` | Insert pending hold (expires stale first) |
| `expire_pair_reservations()` | Mark pending rows past `expires_at` as `expired` |
| `cancel_pair_reservation(uuid)` | Cancel a pending reservation |
| `commit_pair_reservation(uuid)` | Re-validate gates → create `speed_dates` → set queue `paired` |

**TypeScript services:**

| File | Role |
|------|------|
| `src/services/reservationService.ts` | RPC wrappers + logging |
| `src/services/queueOrchestrator.ts` | `planPairsForWindow` — score + reserve (no `speed_dates` yet) |
| `src/services/pairingCoordinator.ts` | `runPlanPairsForWindowWithCoordinator` (optional reservation mode) |

Immediate pairing via `pairingEngine.runPairingForWindow` → `apply_queue_pair` is **unchanged**.

### Option B: Extend `queue_entries.status`

Add `reserved` to check constraint; store partner id in new column `reserved_for_user_id`.

| Pros | Cons |
|------|------|
| Single table | Overloads queue semantics |
| | Hard to represent mutual reservation atomically |
| | `apply_queue_pair` still expects `waiting` at commit |

### Option C: Ephemeral layer (Redis / Edge memory)

| Pros | Cons |
|------|------|
| Fast TTL | Not durable; lost on cold start |
| | Hard to debug beta issues |
| | Supabase-centric stack prefers Postgres |

**Recommendation:** Option A — `pair_reservations` table + RPCs `create_reservation`, `commit_reservation`, `expire_stale_reservations`.

---

## 8. Commit logic

When a speed date completes (or user finishes feedback — policy choice):

### Commit trigger (recommended)

1. **Primary:** Both users’ active date → `completed` AND both queue rows exist for window
2. **Re-join:** User explicitly back on `waiting` (fixes DateQueue re-join gap per CLOSED_BETA_CHECKLIST)

### Commit validation checklist

Before `apply_queue_pair(window, userA, userB)`:

- [ ] Pending reservation exists for pair (or small-pool immediate commit)
- [ ] Reservation not expired
- [ ] Neither user in another pending reservation with different partner
- [ ] Both users: `queue_entries.status = 'waiting'` OR orchestrator atomically transitions waiting + commit in one RPC
- [ ] Hard gates re-pass: blocks, reports, gender, distance, account active
- [ ] Neither user already in active `speed_dates` row
- [ ] Window still live

### On success

```
UPDATE pair_reservations SET status = 'committed', committed_at = now(), speed_date_id = ...
SELECT apply_queue_pair(...)  -- creates speed_dates, sets queue paired
-- Optional: invoke create-call-room (Edge Function)
```

### On failure

```
UPDATE pair_reservations SET status = 'expired' or 'cancelled'
-- Users return to waiting; next orchestrator tick re-plans
```

---

## 9. Call orchestration (Phase 5 — implemented)

Sequence after commit (aligns with [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md)):

```
reservation committed
   ↓
speed_dates row created (apply_queue_pair)
   ↓
create-call-room (on ActiveDate mount — idempotent)
   ↓
get-call-token → LiveKit connect
   ↓
mark_call_participant_joined (each user on connect)
   ↓
Both in room → both_joined_at set → shouldStartTimer = true
   ↓
45s join grace if partner missing → cancel_call_no_show → lobby (no feedback)
```

### Timer policy

| Event | Behavior |
|-------|----------|
| Timer start | When **both** participants connected (`shouldStartTimer`) |
| Join grace | **45s** — then `cancel_call_no_show` |
| Partner no-show | `speed_dates.status = cancelled`; joined user → `waiting`; no-show user → `left` |
| Mid-call disconnect | **20s** reconnect grace; then partner-abandoned → feedback |
| End early before both join | Cancel call; no feedback required |

### RPCs (`015_call_orchestration.sql`)

| RPC | Purpose |
|-----|---------|
| `mark_call_participant_joined` | Record join; set `both_joined_at` when both present |
| `mark_call_participant_left` | Record leave timestamp |
| `cancel_call_no_show` | Grace timeout; return joined user to queue |
| `complete_call_if_valid` | Complete only if `both_joined_at` set |
| `get_call_orchestration_state` | Read call state for sync |

### Call readiness vs UI

- **No new screens** — orchestration in `useSpeedDateCall` + ActiveDate timer gate
- Partner pane subtext reflects connecting / waiting / connected (layout unchanged)

---

## 10. Metrics (Phase 3 — implemented)

Each orchestration tick writes structured metrics to `pairing_run_logs.details` (jsonb). No admin UI yet — use dev console reports.

### Per-run fields (`OrchestrationRunMetrics`)

| Field | Meaning |
|-------|---------|
| `runMode` | `immediate` \| `reservation_plan` \| `reservation_commit` \| `reservation_expire` |
| `waitingCount` / `availableSoonCount` | Candidate pool at run start |
| `pendingReservationCount` | Pending holds before this run |
| `reservationsCreated` / `reservationsCommitted` / `reservationsExpired` | Reservation lifecycle counts for this run |
| `immediatePairsCreated` | Speed dates created (immediate pair or successful commit) |
| `evaluatedPairsCount` | Compatible pairs scored |
| `averageMutualScore` / `lowestAcceptedScore` / `highestRejectedScore` | Score distribution |
| `averageWaitSeconds` | Mean queue wait for waiting users |
| `estimatedWaitSavedSeconds` | Available-soon pre-planning benefit estimate |
| `commitFailureReasonCounts` | e.g. `user_still_active`, `not_waiting`, `expired` |

### Window rollup (`fetchReservationMetrics`)

| Metric | Definition |
|--------|------------|
| `reservationSuccessRate` | `committed / (committed + expired + cancelled)` |
| `reservationExpirationRate` | `expired / totalCreated` |
| `reservationCommitFailureRate` | Failed commits / commit attempts (from run logs) |
| `averageReservationHoldSeconds` | Mean `committed_at - created_at` for committed holds |
| `averageSecondsUntilAvailable` | Mean from plan snapshots (available-soon users) |

### How to read reports

```js
await SpeedSparkMatchingDev.printOrchestrationReport(windowId)
await SpeedSparkMatchingDev.printReservationMetrics(windowId)
```

### Healthy vs unhealthy signals

| Signal | Healthy | Watch | Unhealthy |
|--------|---------|-------|-----------|
| `reservationSuccessRate` | ≥ 70% | 40–70% | < 40% |
| `reservationExpirationRate` | < 30% | 30–50% | > 50% |
| `reservationCommitFailureRate` | < 15% | 15–30% | > 30% (often `user_still_active`) |
| `estimatedWaitSavedSeconds` | > 0 on plan runs with available-soon | — | Always 0 despite available-soon pool |
| `averageWaitSeconds` | Trending down over window | Flat | Rising while reservations expire |

**Healthy example:** success rate 0.82, expiration 0.12, commit failures mostly transient `user_still_active` resolving on retry, `estimatedWaitSavedSeconds` ~45 on plan runs.

**Unhealthy example:** expiration 0.65, success 0.25, repeated `not_waiting` / `expired` — users not returning to queue after dates; TTL too short or re-join gap.

Beta minimum: log to `pairing_run_logs.details` until dashboard exists.

---

## 11. Phased implementation plan

### Phase 1 — Reservation framework (implemented)

- Migration: `013_pair_reservations.sql` — table + RPCs
- `reservationService.ts` — create / fetch / expire / cancel / commit
- `queueOrchestrator.planPairsForWindow` — greedy score + hold reservations
- `pair-live-windows` Edge Function — optional `mode: 'plan'`, `action: 'commit'|'expire'|'report'`
- Dev helpers on `SpeedSparkMatchingDev` (see supabase README §8)
- **Not yet:** auto-switch Edge Function from immediate pair to plan/commit split for available-soon users

**Touches:** `supabase/migrations/013_pair_reservations.sql`, `supabase/functions/pair-live-windows/`, `src/services/reservationService.ts`, `src/services/queueOrchestrator.ts`

### Phase 2 — Available Soon candidate pool (implemented)

- Migration: `014_available_soon_pool.sql` — extends `get_window_matching_context`, commit errors, dev RPCs
- Candidates tagged `availability: 'waiting' | 'available_soon'` with `secondsUntilAvailable`, `speedDateId`, `currentPartnerId`
- `queueOrchestrator.planPairsForWindow` scores full pool:
  - **waiting + waiting** → reserve + attempt immediate commit
  - **waiting + available_soon** or **available_soon + available_soon** → reserve only (extended TTL)
- `pairingEngine.runPairingForWindow` unchanged — still **waiting-only** for `apply_queue_pair`
- Dev RPCs: `seed_active_speed_date_ending_soon`, `end_speed_date_return_to_queue`
- Dev helpers: `seedActiveDatesEndingSoon`, `planReservationsWithAvailableSoon`, `completeActiveDateForTesting`, `commitReservationAfterAvailability`

**Touches:** `supabase/migrations/014_available_soon_pool.sql`, `matchingDataServer.ts`, `queueOrchestrator.ts`, `pairingEngine.ts` (filter only)

### Phase 3 — Reservation analytics (implemented)

- `orchestrationMetrics.ts` — build + persist structured run metrics
- `pairing_run_logs.details` — full `OrchestrationRunMetrics` per tick
- `fetchPairingRunLogs`, `fetchReservationMetrics`, `printOrchestrationReport`
- Edge Function logs plan / commit / expire runs
- Dev: `printOrchestrationReport`, `printReservationMetrics`

**Touches:** `src/services/orchestrationMetrics.ts`, `pairingRunLog.ts`, `pair-live-windows/`

### Phase 4 — Adaptive wait thresholds (implemented)

- `src/constants/waitPolicy.ts` + `src/services/waitPolicy.ts`
- Applied in `pairingEngine.ts` and `queueOrchestrator.ts` after compatibility matrix
- Metrics: `waitBucket`, `poolBucket`, `minimumScoreApplied`, threshold reject counts
- Dev: `SpeedSparkMatchingDev.testWaitPolicy()`, `printWaitPolicyTable()`

### Phase 5 — Call orchestration (implemented)

- Migration `015_call_orchestration.sql` — join/leave timestamps, both-join timer RPCs
- RPCs: `mark_call_participant_joined`, `mark_call_participant_left`, `cancel_call_no_show`, `complete_call_if_valid`
- `get-call-token` no longer marks call active on token issue — active only when both join
- `useSpeedDateCall` — `shouldStartTimer`, join grace (45s), reconnect grace (20s)
- ActiveDate timer starts when `shouldStartTimer === true`; no-show → lobby (no feedback)

---

## 12. Required code changes (summary)

| Area | Change |
|------|--------|
| **Database** | `pair_reservations`; optional `queue_entries.last_available_at`; RPCs commit/expire |
| **RPC** | Extend `get_window_matching_context` for available-soon users |
| **Edge** | `pair-live-windows`: plan/commit split; optional call room after commit |
| **Services** | `queueOrchestrator.ts`, `reservationService.ts`, `waitPolicy.ts` |
| **Unchanged** | `matchingService.ts`, `matchingPriorities.ts`, all onboarding UI |
| **Client** | Minimal: token fetch hook; timer on both-join (ActiveDate internals only) |

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Stale reservation after block/report | Re-validate hard gates at commit; short TTL |
| Double booking | Unique partial indexes on pending reservations per user |
| User never re-joins queue after feedback | Auto-set `waiting` on feedback submit RPC (backend fix for DateQueue gap) |
| Available-soon clock drift | Server-side `started_at` + constant duration; don’t trust client timer |
| Small window user count | Small-pool fast path |
| Reservation starvation | Expire + re-run greedy; wait-time soft relaxation |
| Call room cost if committed but no-show | Create room at commit, delete on cancel; short room TTL |

---

## 14. Recommended implementation order

1. **Document & align** — this spec + team sign-off  
2. **Phase 1** — reservations table + expire + server service  
3. **Fix re-join** — auto `waiting` after feedback (unblocks commit without UI redesign)  
4. **Phase 2** — available-soon in RPC + orchestrator wrapper  
5. **Phase 3** — metrics in `pairing_run_logs`  
6. **Phase 4** — wait-time thresholds  
7. **Phase 5** — call room + both-join timer (parallel with LiveKit integration)

---

## Appendix A — Mapping to current codebase

| v2 concept | Current artifact |
|------------|------------------|
| Pairing tick | `autoPairingWorker.ts` (15s), `pair-live-windows` Edge Function |
| Greedy match | `pairingEngine.runPairingForWindow` |
| Reservation plan | `queueOrchestrator.planPairsForWindow` |
| Reservation RPCs | `reservationService.ts` → `commit_pair_reservation`, etc. |
| Scoring | `matchingService.evaluateCompatibilityMatrix` |
| Server bundle | `get_window_matching_context` RPC |
| Atomic pair | `apply_queue_pair` RPC |
| Queue CRUD | `queueService.ts` |
| Pair detection | `useSpeedDatePairDetection` (Realtime `speed_dates`) |
| Date duration | `DATE_DURATION_SECONDS` in `mockSpeedDates.ts` |
| Run audit | `pairing_run_logs` |

---

## Appendix B — Glossary

| Term | Meaning |
|------|---------|
| **Plan** | Score candidates + create pending reservation |
| **Commit** | Create `speed_dates` + mark queue `paired` |
| **Available Soon** | Active date ending in ≤60s; plan-only |
| **Hold** | Reservation TTL during which users are locked to intended partner |
| **Grace period** | Post-commit window for partner to join call before cancel |
