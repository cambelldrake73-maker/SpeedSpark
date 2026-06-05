# SpeedSpark — Project Inventory

**Last verified:** 2026-06-02  
**Purpose:** Definitive source of truth for what exists, what is partial, and what is mock. Future development prompts should consult this before building or rebuilding features.

**Mode detection:** Supabase is enabled when both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set in `.env` (`src/services/supabaseEnv.ts`). Without them, the app runs in **full demo mode** with mock data.

---

## 1. High-Level Architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | Expo ~56, React Native 0.85, React 19, TypeScript | Cross-platform (iOS, Android, Web) |
| **Navigation** | `@react-navigation/native` + `@react-navigation/native-stack` | Single native stack; no tab navigator |
| **Backend** | Supabase (Postgres + Auth + Realtime + Storage) | No custom API server; client calls Supabase directly via `src/services/` |
| **Database** | PostgreSQL (Supabase) | Schema in `supabase/migrations/` |
| **Auth** | Supabase Auth (email/password) | Session persisted via `@react-native-async-storage/async-storage` (native) or browser (web) |
| **Realtime** | Supabase Realtime `postgres_changes` | Queue, speed dates, feedback, matches, messages |
| **Storage** | Supabase Storage bucket `profile-photos` | Bucket + RLS defined in migration `001`; **no client upload code** |
| **State** | React Context (`AuthContext`, `AppContext`) + feature hooks | No Redux, Zustand, or TanStack Query |
| **Media** | `expo-camera`, `expo-image-picker`, `expo-location` | Local camera preview only; no WebRTC |

### App bootstrap (`App.tsx`)

```
RootErrorBoundary
  └── AuthProvider
        └── AppProvider
              ├── SessionBootstrap   (hydrates profile/prefs on persisted session)
              └── RootNavigator
                    ├── NavigationGate (cold-start route reset)
                    └── Stack.Navigator (initialRouteName: Welcome)
```

### Key directories

| Path | Role |
|------|------|
| `src/screens/` | 17 screen components |
| `src/components/` | Reusable UI |
| `src/context/` | Auth + app state |
| `src/hooks/` | Backend integration hooks |
| `src/services/` | Supabase + matching/queue logic |
| `src/navigation/` | Stack, types, cold-start gate |
| `src/data/` | Mock users, messages, speed-date windows |
| `src/constants/` | Theme, options, legal copy, matching priorities |
| `src/utils/` | Onboarding, auth errors, photo pick, message threading |
| `supabase/migrations/` | SQL schema + RPCs (manual apply in Supabase SQL Editor) |

---

## 2. Frontend Inventory

### Welcome

| Field | Value |
|-------|-------|
| **Route** | `Welcome` |
| **Purpose** | Marketing landing; entry to sign up / log in |
| **Status** | **Complete** (UI) |
| **Backend** | None |
| **Gaps** | Static content only; no analytics or deep links |

---

### Auth

| Field | Value |
|-------|-------|
| **Route** | `Auth` — params: `{ initialMode?: 'signup' \| 'login' }` |
| **Purpose** | Sign up and log in |
| **Status** | **Partial** |
| **Backend (Supabase mode)** | Email sign-up (`signUpWithEmail`), email sign-in (`signInWithEmail`), `syncFromSupabase` after auth, routes to onboarding step or lobby |
| **Backend (demo mode)** | Local `login()` / `markLoggedIn()`; phone flow → `ContactVerification` |
| **Gaps** | Phone login blocked in Supabase mode (alert only). Phone sign-up still navigates to mock OTP in demo only. Supabase sign-up skips `ContactVerification`. Dev connection test button exists but is not production auth. |

---

### ContactVerification

| Field | Value |
|-------|-------|
| **Route** | `ContactVerification` — params: `flow`, `phone`, `email`, `verificationMethod` |
| **Purpose** | 6-digit OTP verification after demo phone/email signup |
| **Status** | **Mock** |
| **Backend** | None — any 6-digit code succeeds; `markContactVerified()` + `markLoggedIn()` are client-only |
| **Gaps** | Not used in Supabase email signup path. No SMS/email provider integration. |

---

### ProfileCreation

| Field | Value |
|-------|-------|
| **Route** | `ProfileCreation` |
| **Purpose** | Onboarding step 1 — name, age, location, height, identity, tags, photos |
| **Status** | **Partial** |
| **Backend (Supabase)** | `saveProfileToServer()` → `profiles` table on continue; **photos skipped** (`skipPhotos = isSupabaseConfigured`) |
| **Backend (demo)** | Local `updateProfile()` only; photos required (3 minimum) |
| **Gaps** | `queerRoles` hardcoded to `[]`. Photos picked locally via `PhotoPickerPlaceholder` but never uploaded to Storage/`profile_photos`. No server persistence for photos. |

---

### Preferences

| Field | Value |
|-------|-------|
| **Route** | `Preferences` — params: `{ fromSettings?: boolean }` |
| **Purpose** | Match preferences — age/distance/height ranges, orientations, dealbreakers, ranked matching priorities |
| **Status** | **Partial** |
| **Backend (Supabase)** | `savePreferencesToServer()` → `dating_preferences` including `matching_priority_order` |
| **Backend (demo)** | Local `updatePreferences()` only |
| **Gaps** | `preferredQueerRoles` always saved as `[]` (UI does not collect queer roles). No gender-preference hard filter in schema or matching. |

---

### Verification

| Field | Value |
|-------|-------|
| **Route** | `Verification` — params: `{ context?: 'onboarding' \| 'window' }` |
| **Purpose** | Identity verification (onboarding) or pre-window safety check |
| **Status** | **Mock** |
| **Backend (onboarding, Supabase)** | `completeOnboarding()` → `saveProfileFields`, `savePreferencesFields`, `markOnboardingComplete` (`onboarded_at`) |
| **Backend (window)** | `verifyForWindow()` — in-memory only; sets `windowIdentityVerified = true` |
| **Gaps** | No live selfie, no vendor integration, no `verification_status` DB update. Placeholder UI with “continue” bypass. |

---

### SpeedDateLobby

| Field | Value |
|-------|-------|
| **Route** | `SpeedDateLobby` |
| **Purpose** | Main hub — live/upcoming windows, join queue, navigate to messages/settings |
| **Status** | **Partial** |
| **Backend (Supabase)** | `useLobbyBackend` — windows, queue join/leave, waiting counts, realtime queue subscription; `useSpeedDatePairDetection` → `ActiveDate` |
| **Backend (demo)** | Mock windows; fake 2.8s match → `ActiveDate` with `MOCK_PARTNER` |
| **Gaps** | `StatStrip` and `LobbyHeader` unread use hardcoded `MOCK_MATCHES.length`. Window reminders are local `Set` only (no SMS/push). No automatic pairing — requires dev console `SpeedSparkMatchingDev.runDevPairing()`. |

---

### DateQueue

| Field | Value |
|-------|-------|
| **Route** | `DateQueue` |
| **Purpose** | Waiting room UI while searching for next pair |
| **Status** | **Partial** |
| **Backend (Supabase)** | `useSpeedDatePairDetection` only — listens for new `speed_dates` row |
| **Backend (demo)** | 2.8s timer → mock `ActiveDate` |
| **Gaps** | **Does not call `joinQueue()`** when entered from `MatchResult` “Join next date”. `onJoinQueue` on `QueueStatusPanel` is no-op (`() => {}`). User may wait indefinitely unless still in queue from lobby. |

---

### ActiveDate

| Field | Value |
|-------|-------|
| **Route** | `ActiveDate` — params: `{ partner: UserProfile; speedDateId?: string }` |
| **Purpose** | 5-minute video date UI |
| **Status** | **Partial** |
| **Backend (Supabase)** | `updateSpeedDateStatus(speedDateId, 'completed')` on end; `blockUser()` → `blocked_users` |
| **Backend (demo)** | Local timer; synthetic `dateId` on end |
| **Gaps** | **No real partner video** — partner pane is placeholder. Local camera via `LocalCameraPreview` only (no WebRTC). Report shows alert only — `createReport()` never called. No signaling server. |

---

### PostDateFeedback

| Field | Value |
|-------|-------|
| **Route** | `PostDateFeedback` — params: `{ partnerId: string; dateId: string }` |
| **Purpose** | Private attractiveness rating (1–10) + “want to match” yes/no |
| **Status** | **Partial** |
| **Backend (Supabase)** | When `dateId` is UUID: `submitDateFeedback()` → RPC `submit_date_feedback_and_resolve` → `date_feedback` + optional `matches` |
| **Backend (demo)** | Local state + `simulatePartnerFeedback()` |
| **Gaps** | Partner profile falls back to `MOCK_PARTNER` if `currentDatePartner` cleared. |

---

### MatchResult

| Field | Value |
|-------|-------|
| **Route** | `MatchResult` — params: `{ partnerId: string; dateId: string }` |
| **Purpose** | Show mutual match, waiting, or no-match outcome |
| **Status** | **Partial** |
| **Backend (Supabase)** | `useSpeedDateMatchResult` — RPC `get_speed_date_match_result`, realtime on `date_feedback` + `matches` |
| **Backend (demo)** | Compares `lastFeedback` vs `partnerFeedback` from context |
| **Gaps** | “Join next date” routes to `DateQueue` without re-joining queue. Real `matchId` passed to Messages on mutual match. |

---

### Messages

| Field | Value |
|-------|-------|
| **Route** | `Messages` — params: `{ matchId?: string }` |
| **Purpose** | Match list + chat threads |
| **Status** | **Partial** |
| **Backend (Supabase)** | `useMessagesBackend` — `fetchUserMatches`, `fetchMatchThread`, `sendMessage`, realtime on `messages` + `matches` |
| **Backend (demo)** | `MOCK_MATCHES` / `MOCK_MESSAGES` |
| **Gaps** | Unmatch is **client-only** (`removeMatchLocally`); no DB delete. Report from chat is placeholder alert. No read receipts, typing indicators, or media messages. Block syncs to Supabase. |

---

### Settings

| Field | Value |
|-------|-------|
| **Route** | `Settings` |
| **Purpose** | Profile shortcuts, notifications toggle, legal links, sign out, delete account |
| **Status** | **Partial** |
| **Backend (Supabase)** | Sign out via `signOutFromSupabase` + local `logout()`. `text_notifications_enabled` **read** on hydrate. |
| **Backend (demo)** | All local |
| **Gaps** | Text notifications toggle updates local state only — `updateTextNotificationsEnabled()` in `profiles.ts` **not wired** from UI. Delete account is local `logout()` only — no Supabase user/data deletion. |

---

### ManageProfile

| Field | Value |
|-------|-------|
| **Route** | `ManageProfile` |
| **Purpose** | Edit profile fields and photos post-onboarding |
| **Status** | **Partial** |
| **Backend** | **None** — `handleSave()` calls `updateCurrentUser()` only |
| **Gaps** | Changes lost on re-hydrate. Photos picked locally but not uploaded. Does not call `saveProfileToServer()`. |

---

### BlockedUsers

| Field | Value |
|-------|-------|
| **Route** | `BlockedUsers` |
| **Purpose** | List and unblock users |
| **Status** | **Partial** |
| **Backend (Supabase)** | List hydrated via `fetchBlockedUsers`; unblock → `unblockUserInSupabase` |
| **Backend (demo)** | Local `blockedUsers` array |
| **Gaps** | Block from this screen not supported (block happens from ActiveDate/Messages). |

---

### LegalDocument

| Field | Value |
|-------|-------|
| **Route** | `LegalDocument` — params: `{ documentId: LegalDocumentId }` |
| **Purpose** | Static legal/help content (privacy, terms, community, help) |
| **Status** | **Complete** |
| **Backend** | None — content from `src/constants/legalContent.ts` |
| **Gaps** | Copy references production features (e.g. account deletion) that are not fully implemented. |

---

## 3. Component Inventory

| Component | Purpose | Used by | Status |
|-----------|---------|---------|--------|
| `BrandLogo` / `BrandWordmark` | App branding | Welcome, Auth | Complete |
| `Button` | Primary actions | Most screens | Complete |
| `Input` | Text fields | Auth, ProfileCreation, ManageProfile | Complete |
| `ScreenContainer` | Safe-area scroll wrapper | All screens | Complete |
| `SelectableOption` | Toggle chips | Auth, PostDateFeedback, Preferences | Complete |
| `OtpInput` | 6-digit code entry | ContactVerification | Complete (mock flow) |
| `PasswordRequirements` | Password rules display | Auth | Complete |
| `FormErrorBanner` | Validation errors | ProfileCreation, ManageProfile, Verification, Preferences | Complete |
| `OnboardingStep` | Step header + progress | ProfileCreation, Preferences, Verification | Complete |
| `ProgressBar` | Onboarding progress bar | OnboardingStep | Complete |
| `PhotoPickerPlaceholder` | Photo grid + camera/library pick | ProfileCreation, ManageProfile | Partial — local URIs only, no upload |
| `LocationSetting` | Device location picker | ProfileCreation, ManageProfile | Complete |
| `HeightFields` | Feet/inches input | ProfileCreation, ManageProfile | Complete |
| `TagSelector` / `ChipGrid` | Multi-select tags | ProfileCreation, ManageProfile, Preferences | Complete |
| `SectionHeader` | Form section titles | ProfileCreation, ManageProfile, Preferences | Complete |
| `DistanceSlider` | Max distance preference | Preferences | Complete |
| `DatingProfileCard` | Profile summary card | PostDateFeedback, MatchResult | Complete |
| `ScaleRating` | 1–10 attractiveness slider | PostDateFeedback | Complete |
| `LobbyHeader` | Lobby top bar (messages, settings) | SpeedDateLobby | Partial — mock unread count |
| `StatStrip` | Lobby stats row | SpeedDateLobby | Mock — hardcoded values |
| `QueueStatusPanel` | Queue join/leave/searching UI | SpeedDateLobby, DateQueue | Complete UI; DateQueue join is no-op |
| `LocalCameraPreview` | Self camera feed | ActiveDate | Complete (local only) |
| `DraggableVideoPiP` | Draggable self-view overlay | ActiveDate | Complete |
| `CameraEffectsPanel` | Blur/background/zoom controls | ActiveDate | Complete (visual only on local feed) |
| `MatchConversationRow` | Match list row | Messages | Complete |
| `MessageBubble` | Chat bubble | Messages | Complete |
| `ProfilePreviewModal` | View match profile from chat | Messages | Complete |
| `SettingsRow` / `SettingsSection` / `SettingsToggleRow` | Settings list UI | Settings | Complete |
| `RootErrorBoundary` | Top-level error boundary | App.tsx | Complete |
| `MatchCard` | Compact user card | — | **Built, unused** |
| `CompatibilityCard` | Compatibility breakdown | — | **Built, unused** |
| `StarRating` | Star rating input | — | **Built, unused** |
| `SparkSelector` | Private signal selector wrapper | — | **Built, unused** |
| `AppearanceSignalSelector` | Appearance signal wrapper | — | **Built, unused** |
| `PrivateSignalSelector` | Base private signal UI | SparkSelector, AppearanceSignalSelector | Built, unused in screens |

---

## 4. Navigation Inventory

### Navigation graph

Single `createNativeStackNavigator` — no tabs, no nested stacks.

```
Welcome
  → Auth → ContactVerification → ProfileCreation → Preferences → Verification → SpeedDateLobby
  → Auth (Supabase) → ProfileCreation | Preferences | Verification | SpeedDateLobby (based on onboarding state)

SpeedDateLobby
  → Settings → ManageProfile | Preferences | BlockedUsers | LegalDocument
  → Messages
  → Verification (window context)
  → ActiveDate (pair detected or demo timer)

DateQueue → ActiveDate (pair detected or demo timer)
ActiveDate → PostDateFeedback
PostDateFeedback → MatchResult
MatchResult → DateQueue | Messages | SpeedDateLobby

Messages → (back) | ProfilePreviewModal
Most settings screens → goBack()
```

### Route params (`src/navigation/types.ts`)

| Route | Params |
|-------|--------|
| `Welcome` | `undefined` |
| `Auth` | `{ initialMode?: 'signup' \| 'login' }` |
| `ContactVerification` | `{ flow?, phone?, email?, verificationMethod? }` |
| `ProfileCreation` | `undefined` |
| `Preferences` | `{ fromSettings?: boolean }` |
| `Verification` | `{ context?: 'onboarding' \| 'window' }` |
| `SpeedDateLobby` | `undefined` |
| `Settings` | `undefined` |
| `ManageProfile` | `undefined` |
| `BlockedUsers` | `undefined` |
| `LegalDocument` | `{ documentId: LegalDocumentId }` |
| `DateQueue` | `undefined` |
| `ActiveDate` | `{ partner: UserProfile; speedDateId?: string }` |
| `PostDateFeedback` | `{ partnerId: string; dateId: string }` |
| `MatchResult` | `{ partnerId: string; dateId: string }` |
| `Messages` | `{ matchId?: string }` |

### Deep-link behavior

**Not implemented.** No `expo-linking` configuration, no URL scheme, no universal links. `navigationRef` exists in `NavigationGate.tsx` for programmatic reset only.

### Cold-start routing

1. `AuthProvider` restores Supabase session (`getCurrentSession` + `onAuthStateChange`).
2. `SessionBootstrap` calls `syncFromSupabase(userId)` if session exists and user not yet logged in locally.
3. `NavigationGate` (Supabase only) calls `resolveOnboardingRoute()` and `navigationRef.reset()` once hydration completes:
   - `ProfileCreation` if profile incomplete
   - `Preferences` if preferences incomplete
   - `Verification` if not onboarded but profile+prefs complete
   - `SpeedDateLobby` if `onboarded_at` set
4. Without Supabase, cold start always lands on `Welcome` (`initialRouteName`).

---

## 5. Context / State Inventory

### AuthContext (`src/context/AuthContext.tsx`)

| Value | Description | Consumers |
|-------|-------------|-----------|
| `isSupabaseEnabled` | Env vars present | AuthScreen, many screens/hooks |
| `isAuthLoading` | Initial session load | NavigationGate |
| `session` | Supabase session | SessionBootstrap, screens |
| `authUser` | `session.user` | Available, lightly used |
| `signUp` | Email sign-up | AuthScreen |
| `signIn` | Email sign-in | AuthScreen |
| `signOut` | Supabase sign-out | SettingsScreen |

**Status:** Complete for email auth lifecycle.

---

### AppContext (`src/context/AppContext.tsx`)

| Value | Description | Consumers |
|-------|-------------|-----------|
| `currentUser` | Active `UserProfile` | Most screens |
| `preferences` | `DatingPreferences` | Preferences, matching |
| `onboarding` | `{ profile, preferences, account? }` | Onboarding screens |
| `isLoggedIn` | Local login flag | NavigationGate, guards |
| `isOnboarded` | `onboarded_at` equivalent | Lobby, queue guards |
| `isHydrating` / `hydrationError` | Supabase sync state | NavigationGate (indirect) |
| `windowIdentityVerified` | Per-session window check | Lobby, DateQueue |
| `currentDatePartner` | Active date partner | ActiveDate, feedback, match result |
| `lastFeedback` / `partnerFeedback` | Demo feedback state | MatchResult (demo) |
| `blockedUsers` | Block list | Settings, BlockedUsers, Messages filter |
| `textNotificationsEnabled` | SMS preference | Settings (local toggle) |
| `syncFromSupabase` | Hydrate from DB | SessionBootstrap, AuthScreen |
| `saveProfileToServer` / `savePreferencesToServer` | Partial DB saves | ProfileCreation, Preferences |
| `completeOnboarding` | Final onboarding save | VerificationScreen |
| `blockUser` / `unblockUser` / `isBlocked` | Block management | ActiveDate, Messages, AppContext |
| `login` / `logout` / `deleteAccount` | Demo auth lifecycle | Auth, Settings |
| `verifyForWindow` / `resetWindowVerification` | Window identity (memory) | Verification, Lobby |

**Status:** Partial — many values are client-only; several server helpers exist but are not wired from all UI paths.

---

### Feature hooks

| Hook | Purpose | Status |
|------|---------|--------|
| `useLobbyBackend` | Windows, queue join/leave, counts, realtime | Complete when Supabase configured |
| `useSpeedDatePairDetection` | Realtime `speed_dates` → navigate ActiveDate | Complete |
| `useSpeedDateMatchResult` | Poll + realtime match resolution | Complete |
| `useMessagesBackend` | Matches, threads, send, realtime | Complete |
| `useMediaAccess` | Camera/mic permissions | Complete (ActiveDate) |

---

## 6. Backend Inventory

All services live under `src/services/`. There is no separate Node/API server.

| File | Purpose | Tables / RPCs | Status |
|------|---------|---------------|--------|
| `auth.ts` | Email sign-up/in, session, sign-out | Supabase Auth | Complete |
| `profiles.ts` | Fetch/save profile & preferences, mark onboarded, text notifications helper | `profiles`, `dating_preferences` | Partial — no `profile_photos` read/write; `updateTextNotificationsEnabled` unused in UI |
| `blocks.ts` | Block/unblock, fetch blocks, create report | `blocked_users`, `reports` | Partial — `createReport` not called from UI; RLS limits bidirectional block reads |
| `windows.ts` | Fetch/upsert speed date windows | `speed_date_windows` | Complete |
| `queueService.ts` | Join, leave, status, counts, waiting entries | `queue_entries` | Complete |
| `matchingData.ts` | Load user profile + prefs for matching | `profiles`, `dating_preferences` | **Partial** — cross-user `dating_preferences` blocked by RLS |
| `matchingService.ts` | Hard filters + ranked weighted scoring | — (reads via matchingData) | Complete logic; degraded in production due to RLS |
| `matchingAppearance.ts` | Appearance fit from past feedback | `date_feedback` | Complete |
| `matchingSafety.ts` | Reported pair keys | `reports` | Partial — reporter-only RLS may miss pairs |
| `pairingEngine.ts` | Greedy max-weight pairing → `apply_queue_pair` RPC | `queue_entries`, `speed_dates` | Complete logic; **not triggered automatically** |
| `speedDates.ts` | Active date fetch, status update, recent pairs | `speed_dates` | Complete |
| `dateFeedback.ts` | Submit feedback, fetch match result | `date_feedback`, `matches` via RPCs | Complete |
| `messages.ts` | Matches list, thread, send, merge | `matches`, `messages` | Complete |
| `realtimeSubscriptions.ts` | All Realtime channel wrappers | See §9 | Complete |
| `supabase.ts` | Supabase client singleton | — | Complete |
| `supabaseEnv.ts` | Env detection | — | Complete |
| `supabaseHealth.ts` | Connection/signup diagnostics | — | Dev utility |
| `backendLogger.ts` | Structured backend logs | — | Complete |
| `dev/matchingDev.ts` | Dev console: seed window, simulate queue, run pairing | All queue/matching tables | Dev-only; exposed as `globalThis.SpeedSparkMatchingDev` |

### RPCs (Postgres, SECURITY DEFINER)

| RPC | Migration | Purpose |
|-----|-----------|---------|
| `apply_queue_pair(window_id, user_a, user_b)` | 002 | Atomically create `speed_dates` + mark queue entries `paired` |
| `get_speed_date_match_result(speed_date_id)` | 003 | Feedback status + mutual match resolution |
| `submit_date_feedback_and_resolve(...)` | 003 | Insert feedback + create `matches` on mutual yes |

---

## 7. Database Inventory

Migrations must be applied manually in order (`001` → `005`). See `supabase/README.md`.

### `profiles`

| Field | Value |
|-------|-------|
| **Purpose** | User profile data linked to `auth.users` |
| **Usage** | CRUD via `profiles.ts`; auto-created on sign-up trigger in `001` |
| **Screens** | ProfileCreation, ManageProfile (local only), Settings, matching, messages partner fetch |
| **RLS** | Select: self or non-blocked users. Insert/update: own row only. |

### `profile_photos`

| Field | Value |
|-------|-------|
| **Purpose** | Photo metadata + storage paths |
| **Usage** | **Not used by app code** — `fetchProfile` always passes `photos: []` |
| **Screens** | None (UI collects local URIs only) |
| **RLS** | Select with profile access; manage own photos. Storage bucket `profile-photos` also configured. |

### `dating_preferences`

| Field | Value |
|-------|-------|
| **Purpose** | Match filters and `matching_priority_order` |
| **Usage** | Onboarding/settings save; matching engine (own row only via client) |
| **Screens** | Preferences, matching (backend) |
| **RLS** | **Select/update: own row only** — blocks client-side reads of other users' preferences |

### `speed_date_windows`

| Field | Value |
|-------|-------|
| **Purpose** | Scheduled live dating windows |
| **Usage** | Lobby display; dev seeding |
| **Screens** | SpeedDateLobby |
| **RLS** | Select: all authenticated. No client insert policy (dev uses service upsert). |

### `queue_entries`

| Field | Value |
|-------|-------|
| **Purpose** | Per-window waiting queue |
| **Usage** | Lobby join/leave; pairing engine input |
| **Screens** | SpeedDateLobby (join), DateQueue (listen only) |
| **RLS** | Manage own entries; select all for live window counts |

### `speed_dates`

| Field | Value |
|-------|-------|
| **Purpose** | Active/completed pairings |
| **Usage** | Created via `apply_queue_pair` RPC; status updated on date end |
| **Screens** | ActiveDate, PostDateFeedback, MatchResult, pair detection |
| **RLS** | Select: participants. Update: participants. Insert: RPC only. |

### `date_feedback`

| Field | Value |
|-------|-------|
| **Purpose** | Private post-date ratings |
| **Usage** | Submit via RPC; matching appearance scores |
| **Screens** | PostDateFeedback, MatchResult |
| **RLS** | Manage own feedback rows only (rater) |

### `matches`

| Field | Value |
|-------|-------|
| **Purpose** | Mutual matches after speed dates |
| **Usage** | Created by feedback RPC; messages threads |
| **Screens** | MatchResult, Messages |
| **RLS** | Select: participants. Update: participants (`last_message_at`). Insert: RPC only. |

### `messages`

| Field | Value |
|-------|-------|
| **Purpose** | Chat messages per match |
| **Usage** | Send/fetch/realtime |
| **Screens** | Messages |
| **RLS** | Select/insert: match participants only |

### `blocked_users`

| Field | Value |
|-------|-------|
| **Purpose** | User blocks |
| **Usage** | Block from ActiveDate/Messages; pairing block check in RPC |
| **Screens** | BlockedUsers, Settings count |
| **RLS** | Manage own blocks (`blocker_id = auth.uid()`) — **does not expose rows where user is `blocked_id`** |

### `reports`

| Field | Value |
|-------|-------|
| **Purpose** | Safety reports |
| **Usage** | `createReport()` service exists; matching safety reads own reports |
| **Screens** | None wired — ActiveDate/Messages use placeholder alerts |
| **RLS** | Insert/read own reports only |

---

## 8. Migration Inventory

| # | Filename | Purpose | Depends on | Status |
|---|----------|---------|------------|--------|
| 1 | `001_initial_schema.sql` | All tables, RLS, auth trigger (`handle_new_user`), storage bucket policies | — | Required; must run first |
| 2 | `002_matching_queue_rpc.sql` | `apply_queue_pair` RPC; `speed_dates` UPDATE policy | 001 | Required for pairing |
| 3 | `003_feedback_match_rpc.sql` | `get_speed_date_match_result`, `submit_date_feedback_and_resolve` | 002 | Required for feedback/matches |
| 4 | `004_messages_match_update.sql` | `matches` UPDATE policy for `last_message_at` | 003 | Required for messaging |
| 5 | `005_matching_priority_order.sql` | Adds `dating_preferences.matching_priority_order text[]` | 004 | Required for ranked preferences |

**Apply method:** Supabase Dashboard → SQL Editor (manual). No Supabase CLI migration tracking in repo.

**Post-migration:** Enable Realtime replication on `queue_entries`, `speed_dates`, `date_feedback`, `matches`, `messages`.

---

## 9. Realtime Inventory

| Subscription | Source table | Trigger | Consumer | Status |
|--------------|--------------|---------|----------|--------|
| `subscribeToQueueWindow` | `queue_entries` | `*` filtered by `window_id` | `useLobbyBackend` | Active when Supabase + live window |
| `subscribeToSpeedDatesForUser` | `speed_dates` | `*` (client filters by user) | `useSpeedDatePairDetection` | Active in lobby/queue when searching |
| `subscribeToFeedbackForSpeedDate` | `date_feedback` | `*` filtered by `speed_date_id` | `useSpeedDateMatchResult` | Active on MatchResult |
| `subscribeToMatchesForUser` | `matches` | `*` (client filters by user) | `useSpeedDateMatchResult` | Active on MatchResult |
| `subscribeToMatchMessages` | `messages` | `INSERT` filtered by `match_id` | `useMessagesBackend` | Active when chat open |

**Requirements:** Tables must be added to Supabase Realtime publication. Without this, pair detection and chat fall back to polling (match result polls every 3s).

---

## 10. Mock vs Production Matrix

| Feature | Demo Mode (no `.env`) | Supabase Mode | Status |
|---------|----------------------|---------------|--------|
| Auth | Local `login()` / mock phone OTP | Email sign-up/in only | Partial |
| Contact verification | Mock OTP (any 6 digits) | Skipped for email signup | Mock / N/A |
| Profile onboarding save | Local state | `profiles` table | Partial (no photos) |
| Preferences save | Local state | `dating_preferences` + priority order | Partial (no queer roles) |
| Onboarding complete | Local flag | `onboarded_at` timestamp | Complete |
| Identity verification | Placeholder bypass | Placeholder bypass | Mock |
| Window identity check | In-memory flag | In-memory flag | Mock |
| Speed date windows | `MOCK_SPEED_DATE_WINDOWS` | `speed_date_windows` table | Partial (needs seeded live window) |
| Queue join/leave | UI state only | `queue_entries` | Complete |
| Queue counts (realtime) | Mock count | Realtime + query | Complete |
| Pairing / matchmaking | 2.8s mock timer | `pairingEngine` + RPC (manual dev trigger) | **Not production-automated** |
| Pair → ActiveDate routing | Mock navigation | Realtime `speed_dates` | Complete |
| Video call | Local camera + placeholder partner | Same | Mock |
| End date → feedback | Local | `speed_dates.status = completed` | Complete |
| Post-date feedback | Local + simulated partner | RPC → `date_feedback` | Complete |
| Mutual match creation | Simulated in context | RPC → `matches` | Complete |
| Match result screen | Context comparison | RPC + realtime | Complete |
| Messages list/thread | `MOCK_MATCHES` | `matches` + `messages` | Complete |
| Send message | Local state | Insert + `last_message_at` update | Complete |
| Unmatch | Local list remove | Local list remove only | Not connected |
| Block user | Local array | `blocked_users` upsert | Partial (RLS gaps for “blocked by”) |
| Report user | Alert placeholder | `createReport()` exists, unused | Not connected |
| Profile editing (post-onboarding) | Local only | Not saved | Not connected |
| Photos | Local URIs, required in demo | Skipped in onboarding; no upload | Not connected |
| Text notifications toggle | Local state | Read on hydrate; write not wired | Partial |
| Delete account | Local logout | Local logout only | Not connected |
| Push notifications | N/A | N/A | Not implemented |
| Lobby stats / unread | Hardcoded mocks | Hardcoded mocks | Mock |
| Deep links | N/A | N/A | Not implemented |

---

## 11. Known Gaps

Only features **genuinely not implemented** or **not connected end-to-end**.

### Critical for MVP

1. **Automatic pairing in production** — `runPairingForWindow` only invoked via `SpeedSparkMatchingDev.runDevPairing()`; no cron, edge function, or lobby trigger.
2. **Cross-user preference reads for matching** — RLS on `dating_preferences` restricts SELECT to own row; client pairing scores other users with empty/default prefs.
3. **Photo upload pipeline** — `profile_photos` table + Storage bucket exist; no upload, no fetch, onboarding skips photos when Supabase on.
4. **Real partner video** — No WebRTC/signaling; partner video pane is a placeholder.
5. **DateQueue re-join** — “Join next date” navigates to `DateQueue` without calling `joinQueue()`.
6. **ManageProfile persistence** — Saves to AppContext only, not Supabase.
7. **Identity verification** — Placeholder UI; no vendor, no DB `verification_status` updates.
8. **Reports** — `createReport()` implemented but no screen calls it.
9. **Delete account** — No Supabase auth user deletion or cascade cleanup from UI.
10. **Bidirectional block visibility** — RLS may prevent detecting when another user blocked you (matching safety incomplete).

### Nice to have

1. Phone auth / real OTP (`ContactVerification` is demo-only).
2. Text notifications — `updateTextNotificationsEnabled()` not wired from Settings toggle.
3. Unmatch — client-side list removal only; no `matches` delete/archive.
4. Lobby `StatStrip` / unread badge — hardcoded `MOCK_MATCHES.length`.
5. Window reminders — local toggle only; no SMS/push delivery.
6. `preferredQueerRoles` / `queerRoles` — always saved as `[]`.
7. Gender preference hard filter — not in schema or `matchingService`.
8. Unused components: `MatchCard`, `CompatibilityCard`, `StarRating`, `SparkSelector`, etc.
9. Read receipts, typing indicators, media messages.
10. `fetchProfile` does not load photos from `profile_photos`.

### Future roadmap

1. Push notifications (APNs / FCM) and SMS window alerts.
2. Deep linking / universal links for matches and windows.
3. Server-side matching (edge function) to avoid client RLS limitations.
4. Admin dashboard for reports, window scheduling, pairing oversight.
5. Compatibility display in UI (`CompatibilityCard` exists but unused).
6. Supabase CLI migration workflow and CI deploy.
7. Account data export (GDPR).

---

## 12. Launch Readiness

Estimates based on **end-to-end production readiness**, not UI completeness.

| Area | Estimate | Rationale |
|------|----------|-----------|
| **Core functionality** | **~55%** | Full demo flow works; Supabase path works with manual dev pairing for multi-user dates. Feedback → match → messages path is wired when migrations applied. |
| **Backend** | **~65%** | Schema, RLS, RPCs, and client services exist for main entities. Missing: automated pairing, photo pipeline, server-side matching, account deletion, notification delivery. |
| **Frontend** | **~75%** | All 17 screens built with polished UI. Many screens still mock or partially connected (video, verification, manage profile, queue re-join, lobby stats). |

### Remaining blockers (production launch)

1. Apply migrations `001`–`005` and enable Realtime on five tables.
2. Implement **automatic pairing** (scheduled job or realtime trigger when queue has waiting users).
3. Fix **RLS for matching** (server-side pairing function or policy allowing read of prefs for queued users).
4. **Photo upload + verification** pipeline tied to identity checks.
5. **WebRTC** or managed video SDK for real 5-minute dates.
6. Wire **ManageProfile**, **Settings** (notifications, delete), and **reports** to backend.
7. Fix **DateQueue** to re-join queue after a completed date.
8. Replace lobby **mock stats** with real match/queue metrics.

### Manual setup checklist (developer)

- [ ] Copy `.env.example` → `.env` with Supabase URL + anon key
- [ ] Run migrations 001–005 in SQL Editor
- [ ] Enable Realtime on listed tables
- [ ] Disable email confirmation for dev (optional)
- [ ] Seed a live window: `await SpeedSparkMatchingDev.seedDevLiveWindow()`
- [ ] Two test users complete onboarding
- [ ] Both join queue; run `SpeedSparkMatchingDev.runDevPairing(windowId)`

---

## Appendix: Dev testing entry points

Exposed in `__DEV__` via `src/services/dev/matchingDev.ts` as `globalThis.SpeedSparkMatchingDev`:

- `seedDevLiveWindow()` — create live window
- `simulateQueuePopulation(windowId, userIds)` — join users to queue
- `runDevPairing(windowId)` — run greedy pairing engine
- `printDevQueueReport(windowId)` — debug queue state
- `compareDevMatchScores(userA, userB)` — inspect match scores

See `supabase/README.md` for step-by-step testing instructions.

---

*This document reflects the codebase as of the verification date. Re-verify after significant changes.*
