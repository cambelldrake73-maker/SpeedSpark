# Video integration plan — SpeedSpark

Planning document only. No implementation in this milestone.

**Source of truth:** [PROJECT_INVENTORY.md](./PROJECT_INVENTORY.md)  
**Scope:** Real 5-minute voice/video speed dates inside the existing `ActiveDate` flow, with minimal UI change.

---

## 1. Current ActiveDate architecture

### How ActiveDate works today

`ActiveDateScreen` is a self-contained call UI that runs a countdown, shows local + partner video panes, and routes to feedback when the date ends.

**Entry paths**

| Source | Trigger | Navigation |
|--------|---------|------------|
| `SpeedDateLobbyScreen` | Demo: 2.8s timer | `navigate('ActiveDate', { partner: MOCK_PARTNER })` — no `speedDateId` |
| `SpeedDateLobbyScreen` | Supabase: `useSpeedDatePairDetection` | `navigate('ActiveDate', { partner, speedDateId })` |
| `DateQueueScreen` | Same pattern | `replace('ActiveDate', …)` |

Pair detection (`useSpeedDatePairDetection`) subscribes to Realtime `speed_dates` INSERT/UPDATE, fetches partner profile, dedupes by `speedDateId`, then calls `onPaired`.

**Layout (unchanged in this plan)**

- Top: LIVE pill + 5-minute countdown + progress bar
- Stage: main feed (partner) + draggable PiP (self), swappable via tap
- Controls: mute, video, speaker, report, block
- Bottom: “End date early” button
- Permission banner when camera/mic not granted

**Timer / end flow**

- Duration: `DATE_DURATION_SECONDS` — **300s production**, **60s in `__DEV__`** (`src/data/mockSpeedDates.ts`)
- Countdown via `setTimeout` loop; at `secondsLeft <= 0` → `goToFeedback()`
- `goToFeedback()` is idempotent (`hasEndedRef`); sets `speed_dates.status = 'completed'` when `speedDateId` present; navigates to `PostDateFeedback` with `{ partnerId, dateId }`

**Report / block flow**

- **Report:** existing alerts/modals → `reportUser({ context: 'call', speedDateId })` → `goToFeedback()`
- **Block:** `blockUser(partner, { speedDateId })` → cancels speed date via `blockUserWithSafety` → `navigation.reset` to lobby (skips feedback)
- **End early:** confirm → `goToFeedback()` (same as timer expiry)

**Media today**

| Piece | Implementation | Real? |
|-------|----------------|-------|
| Permissions | `useMediaAccess` — `expo-camera` permissions (native), `getUserMedia` probe (web) | Yes (local only) |
| Self video | `LocalCameraPreview` → `expo-camera` `CameraView` | Local preview only — **not** sent to partner |
| Partner video | `PartnerVideoPane` — gradient + icon placeholder | **Mock** |
| Mute / video / speaker toggles | Local React state | **UI only** — no SDK tracks |
| Blur / virtual background | Visual overlays on `CameraView` | Local effects only |
| Connection status chip | Shows permission state (“Connected” = cam/mic granted) | **Misleading label** — not a call connection |

**Backend touchpoints today**

| Event | Supabase |
|-------|----------|
| Pair created | `apply_queue_pair` RPC → `speed_dates` row (`status = active`, `started_at = now()`) |
| Date ends normally | `updateSpeedDateStatus(id, 'completed')` |
| Block during date | `blocked_users` insert + `speed_dates.status = cancelled` |
| Report during date | `reports` insert (`context = call`) |

**Route params**

```typescript
ActiveDate: { partner: UserProfile; speedDateId?: string }
```

- `partner` — full profile for display; required
- `speedDateId` — UUID when paired via Supabase; omitted in demo/mock path

**What is mock today**

1. Partner video/audio (no WebRTC, no managed room)
2. Control bar actions (mute/video/speaker do not affect a call)
3. “Connected” status (permissions ≠ call connected)
4. Demo lobby timer path (no backend row)
5. Camera effects are cosmetic on local preview only

---

## 2. Options comparison

Stack context: **Expo SDK 56**, **React Native 0.85**, **react-native-web**, Supabase backend, safety-first dating product.

| Criterion | Daily.co | Agora | Twilio Video | Native WebRTC | LiveKit |
|-----------|----------|-------|--------------|---------------|---------|
| **Expo compatibility** | `@daily-co/react-native-daily-js` — requires **dev build** (not Expo Go) | `react-native-agora` — dev build + native modules | RN wrapper exists but mature path is web-first; RN needs dev build | `react-native-webrtc` — dev build, config plugins | `@livekit/react-native` + Expo config plugin — dev build |
| **iOS** | Good; prebuilt SDK | Excellent | Good | Good with TURN setup | Excellent |
| **Android** | Good | Excellent | Good | Good with TURN setup | Excellent |
| **Web** | `@daily-co/daily-js` — strong | `agora-rtc-sdk-ng` | `twilio-video` — mature | `RTCPeerConnection` directly | `livekit-client` — strong |
| **Ease of implementation** | **Highest** — rooms + tokens + RN SDK in days | Medium — powerful but verbose SDK surface | Medium-high — enterprise APIs, more boilerplate | **Lowest** — signaling, TURN, reconnection, simulcast yourself | **High** — room model similar to Daily, good RN/web parity |
| **Cost (MVP scale)** | Free tier ~10k participant-min/mo; then ~$0.004/participant-min | 10k free mins/mo; complex tiering | Pay-as-you-go; historically expensive at scale | Infra only (TURN ~$0.05–0.10/GB + server) | Cloud free tier 50k participant-min/mo; self-host option |
| **Backend requirements** | Edge Function mints meeting token with API key | Edge Function generates RTC token (App ID + certificate) | Edge Function creates room + access token | Signaling server + TURN (coturn/Cloudflare) + token auth | Edge Function mints JWT with API key/secret |
| **Privacy / safety fit** | Recording off by default; max 2 participants; room expiry; EU region option | Recording opt-in; content moderation add-ons extra | Recording policies configurable; strong enterprise compliance story | Full control — you own every policy | Recording off by default; open-source auditable; max participants enforced server-side |

### Per-option notes

#### Daily.co
- **Pros:** Fastest MVP; built-in 1:1 rooms; prebuilt UI optional (can use custom views); solid web + RN.
- **Cons:** Vendor lock-in; pricing jumps after free tier; less self-host flexibility.

#### Agora
- **Pros:** Battle-tested at scale; global edge network; strong mobile performance.
- **Cons:** SDK complexity; pricing math harder to predict; moderation is an add-on.

#### Twilio Video
- **Pros:** Enterprise trust, compliance docs, Programmable Video APIs.
- **Cons:** Higher cost; Twilio RN ecosystem less aligned with modern Expo; heavier integration.

#### Native WebRTC
- **Pros:** No per-minute vendor fee; maximum control; no third-party media path (if self-hosted TURN).
- **Cons:** 4–8+ weeks extra for signaling, reconnect, codec quirks, iOS/Android/web parity; operational burden (TURN abuse, NAT traversal).

#### LiveKit
- **Pros:** Same room/token mental model as Daily; excellent RN + web SDKs; open source + cloud; easy “max 2 participants, 6 min TTL”; fits Supabase Edge Functions.
- **Cons:** Requires dev build; self-host ops if avoiding cloud later.

---

## 3. Recommended approach

### MVP choice: **LiveKit Cloud + Supabase Edge Functions**

**Why LiveKit over alternatives for SpeedSpark**

1. **Cross-platform parity** — One room model for iOS, Android, and web (all three are in scope per inventory).
2. **Safety architecture** — Server-minted JWTs, max 2 participants, short TTL, recording disabled at project level; no client secrets.
3. **Cost path** — Generous free tier for MVP; optional self-host later without rewriting client integration.
4. **Minimal UI change** — Swap `PartnerVideoPane` / `LocalCameraPreview` internals for `VideoTrack` components; keep existing layout, timer, and controls.
5. **Fits existing Supabase flow** — Room created when `speed_dates` row is created; token fetched when `ActiveDate` mounts.

**Runner-up (fastest POC): Daily.co** — Choose if the goal is a demo in <1 week and vendor lock-in is acceptable.

**Do not start with native WebRTC** for MVP — safety, time-to-market, and Expo maintenance cost are poor fits.

---

## 4. Required database changes

Extend the pairing lifecycle with call metadata. Prefer a **1:1 `speed_date_calls` table** (keeps `speed_dates` stable) or add nullable columns to `speed_dates`.

### Proposed schema (new table)

```sql
speed_date_calls (
  id                    uuid PK
  speed_date_id         uuid UNIQUE FK → speed_dates(id)
  provider              text NOT NULL  -- 'livekit' | 'daily' | ...
  room_name             text NOT NULL  -- provider room identifier
  provider_session_id   text           -- optional provider-side session/room SID
  call_status           text NOT NULL  -- 'pending' | 'ready' | 'active' | 'ended' | 'failed' | 'cancelled'
  scheduled_duration_sec int NOT NULL DEFAULT 300
  call_started_at       timestamptz    -- first participant joined
  call_ended_at         timestamptz
  user_a_joined_at      timestamptz
  user_b_joined_at      timestamptz
  user_a_left_at        timestamptz
  user_b_left_at        timestamptz
  created_at            timestamptz DEFAULT now()
  updated_at            timestamptz DEFAULT now()
)
```

### Field purposes

| Field | Purpose |
|-------|---------|
| `room_name` | Stable provider room ID (e.g. `speed-date-{uuid}`) |
| `provider_session_id` | Provider webhook correlation / support tickets |
| `call_status` | Gate token issuance and rejoin prevention |
| `call_started_at` / `call_ended_at` | Audit + billing reconciliation |
| `user_*_joined_at` / `left_at` | Connection status, debugging, safety review |
| `scheduled_duration_sec` | Align server room TTL with 5-minute product rule |

### RLS

- Participants (`user_a_id` / `user_b_id` via join to `speed_dates`) may **read** their call row.
- **Insert/update** only via `service_role` or SECURITY DEFINER RPC (same pattern as pairing).
- Join tokens are **never stored** in Postgres — minted on demand, short-lived.

### `speed_dates` alignment

Keep existing `status` (`active` | `completed` | `cancelled`) as source of truth for app navigation. `speed_date_calls.call_status` tracks media layer only.

---

## 5. Backend architecture

### Principle

**Never mint provider tokens or create rooms from the mobile/web client.** API keys stay in Supabase Edge Function secrets.

### Room creation timing

```
apply_queue_pair (RPC)
  → INSERT speed_dates (status = active)
  → TRIGGER or async Edge Function: create-call-room
       → Provider API: create room (max 2, empty timeout, max duration ~360s)
       → INSERT speed_date_calls (status = ready, room_name = ...)
```

Use **database webhook** or **explicit invoke from pairing Edge Function** (`pair-live-windows`) after successful pair — not from client.

### Token issuance (on ActiveDate entry)

```
Client: POST /functions/v1/get-call-token { speedDateId }
  → Verify auth.uid() is participant
  → Verify speed_dates.status = 'active'
  → Verify speed_date_calls.call_status in ('ready', 'active')
  → Mint JWT (LiveKit) or meeting token (Daily)
  → Return { token, roomName, wsUrl, expiresAt }
```

Token claims: `identity = userId`, room = `room_name`, TTL ≈ **6 minutes** (5 min date + buffer).

### Call lifecycle events

| Event | Backend action |
|-------|----------------|
| Both joined | `call_status = active`, set `call_started_at` |
| Timer / end early | Client leaves room → `call_status = ended`, sync `speed_dates.status = completed` |
| Block / report | Leave room → `cancelled` / `ended`, existing safety RPCs |
| Provider webhook (optional Phase 3) | Update `user_*_joined_at`, detect disconnects |

### Edge Functions (new)

| Function | Role |
|----------|------|
| `create-call-room` | Service role; called on pair |
| `get-call-token` | Authenticated; called on ActiveDate mount |
| `end-call` (optional) | Force-kick room on block/admin action |

---

## 6. Frontend integration points

**Goal:** Replace mock media internals only. Do not change screen layout, navigation, or control placement.

### New hook: `useSpeedDateCall(speedDateId, userId)`

Responsibilities:

1. Fetch token from `get-call-token` Edge Function
2. Connect to LiveKit room
3. Expose `{ localVideoTrack, remoteVideoTrack, connectionState, mute, setVideoEnabled, leave }`
4. Map existing UI state (`isMuted`, `isVideoOn`) to SDK calls
5. On `leave()` / unmount → disconnect and idempotently end call

### Component swaps (same props / layout)

| Current | Future |
|---------|--------|
| `PartnerVideoPane` | `PartnerVideoPane` renders remote `VideoTrack` or existing placeholder while connecting |
| `LocalCameraPreview` | Render local `VideoTrack`; keep blur/background as optional post-MVP |
| `useMediaAccess` | Keep for permission gating; may delegate to LiveKit permission flow on native |
| Stage status chip | Show real `connectionState` (`connecting` / `connected` / `reconnecting` / `failed`) |

### ActiveDateScreen wiring (minimal diff)

1. **On mount** (when `speedDateId` present): `useSpeedDateCall` connects
2. **Timer unchanged** — still client countdown; server room max duration is backup
3. **`goToFeedback`** — call `leave()` before navigate
4. **`confirmBlock`** — call `leave()` then existing block flow
5. **`submitReport`** — call `leave()` then existing report flow
6. **Demo mode** (no `speedDateId`) — keep current placeholder behavior

### New files (future implementation)

```
src/hooks/useSpeedDateCall.ts
src/services/callTokens.ts          // fetch token from Edge Function
src/components/RemoteVideoView.tsx  // wraps LiveKit VideoTrack
src/components/LocalVideoView.tsx   // replaces CameraView path when in call
```

### Expo config (future)

- EAS development build (required — **Expo Go will not work**)
- LiveKit Expo config plugin in `app.json`
- iOS: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`
- Android: `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`

---

## 7. Safety requirements

| Requirement | Implementation |
|-------------|----------------|
| Report during call | Already wired — ensure `leave()` runs before exit; keep `speedDateId` on report row |
| Block during call | Already cancels `speed_dates` — add `end-call` to kick provider room |
| End call | `leave()` + `updateSpeedDateStatus(completed)`; revoke token via TTL |
| 5-minute timeout | Client timer (existing) + provider room `max_duration` + token expiry |
| Prevent rejoin ended call | Token endpoint rejects if `speed_dates.status !== 'active'` or `call_status = ended` |
| No recording by default | LiveKit project setting `recordings.enabled = false`; no egress API calls |
| Moderation | Existing `reports` + `blocked_users`; optional provider webhook logs to `speed_date_calls` |

Additional recommendations:

- Bind token `identity` to Supabase `auth.uid()` — never allow arbitrary identities
- Log room create/token issue events server-side (no PII in client logs)
- On block, immediately disconnect **both** participants via admin API

---

## 8. MVP implementation phases

### Phase 1 — Voice-first proof of concept (1–2 weeks)

- [ ] EAS dev build with LiveKit SDK
- [ ] `create-call-room` + `get-call-token` Edge Functions
- [ ] `speed_date_calls` migration
- [ ] `useSpeedDateCall` — **audio only** (video tracks disabled)
- [ ] Replace “Connected” chip with real connection state
- [ ] Verify: pair → hear partner → timer ends → feedback flow unchanged
- **UI change:** none structural — partner pane shows avatar/waveform until Phase 2

### Phase 2 — Full video (1–2 weeks)

- [ ] Enable video tracks; wire `PartnerVideoPane` + PiP to LiveKit views
- [ ] Map mute / video / speaker controls to SDK
- [ ] Web parity test (Chrome/Safari)
- [ ] Remove or gate `expo-camera` `CameraView` during active call (single capture pipeline)
- [ ] Connection quality fallback (audio-only if video fails)

### Phase 3 — Production safety & hardening (2–3 weeks)

- [ ] Provider webhooks → update join/leave timestamps
- [ ] `end-call` admin kick on block/cancel
- [ ] Server-enforced room teardown on `speed_dates.status` change (Realtime trigger)
- [ ] Load test: N concurrent 5-min rooms in one window
- [ ] App Store privacy nutrition labels + in-app disclosure copy
- [ ] Monitoring: token failures, room create failures, avg connect time
- [ ] Document incident runbook (see [MODERATION.md](./MODERATION.md))

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **App Store permissions** | Rejection if usage strings vague | Clear strings: “SpeedSpark uses camera/mic for live 5-minute dates with matches.” |
| **Camera/mic permissions** | Users deny → broken dates | Keep existing permission banner; block queue join without grant |
| **Expo Go limitations** | Cannot test WebRTC in Go | EAS dev build from Phase 1; document in README |
| **Development builds required** | Slower iteration vs Expo Go | EAS internal distribution for testers |
| **Cost spikes** | Live window with many concurrent 5-min calls | Max 2 per room; room auto-expire; monitor participant-minutes |
| **Moderation / safety** | Harassment on live video | Report/block already exist; add instant room kill on block; no recording |
| **“Connected” UX confusion** | Users think they’re live before SDK connects | Fix status chip in Phase 1 |
| **Web mobile Safari** | Background tab suspends media | Warn users; prefer native apps for production |
| **TURN abuse** (if self-hosting later) | Unexpected bandwidth bills | Stay on LiveKit Cloud for MVP |

---

## 10. Final recommendation

### Build this first

1. **LiveKit Cloud** account with recordings **disabled**
2. **Supabase migration** `010_speed_date_calls.sql` (schema in §4)
3. **Edge Function `get-call-token`** — authenticated token mint only
4. **Edge Function `create-call-room`** — invoked when `speed_dates` row created
5. **EAS development build** — do not attempt in Expo Go
6. **Phase 1 audio POC** inside existing `ActiveDateScreen` — no layout changes
7. **Phase 2 video** — swap `PartnerVideoPane` / PiP internals to LiveKit tracks

### Do not build first

- Custom WebRTC signaling server
- Client-side room creation or token minting
- Recording, cloud egress, or “save date” features
- New screens or redesigned call UI

### Success criteria for MVP video

- Two real Supabase-paired users join the same LiveKit room from lobby → ActiveDate
- They see/hear each other for the timed 5 minutes (60s in dev)
- End / report / block behave as today and tear down the room
- Ended dates cannot re-fetch a join token
- Demo mode (no Supabase) still works with placeholder video

---

## Appendix: inventory cross-reference

| Inventory gap | This plan |
|---------------|-----------|
| No real partner video | LiveKit remote tracks in `PartnerVideoPane` |
| Local camera only | Unified SDK capture pipeline |
| No signaling server | LiveKit Cloud + Edge Function tokens |
| `ActiveDate` partial backend | Add call layer alongside existing `speed_dates` status |
| WebRTC listed as next milestone | Managed SDK first; native WebRTC deferred |

**Related docs:** [MODERATION.md](./MODERATION.md) · [supabase/README.md](../supabase/README.md)
