# EAS build readiness — SpeedSpark

**Purpose:** Prepare iOS and Android **development builds** for closed beta testing (LiveKit voice, Supabase backend).  
**Sources:** [PROJECT_INVENTORY.md](./PROJECT_INVENTORY.md) · [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) · [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md)

**Last audited:** 2026-06-02  
**Expo SDK:** 56 · **React Native:** 0.85.3

---

## Executive summary

| Platform | Config ready? | Can build today? |
|----------|---------------|------------------|
| **iOS (device)** | Yes — pending Apple Developer + EAS link | After `eas login`, register bundle ID, set env secrets |
| **iOS (simulator)** | Yes | Fastest iOS smoke test (`development-simulator` profile) |
| **Android (APK)** | Yes — pending EAS link + env secrets | Internal APK install, no Play Store required |
| **Expo Go** | **Not supported** | LiveKit WebRTC native modules missing |

---

## 1. Dependency audit

### Core stack

| Package | Version | Build role |
|---------|---------|------------|
| `expo` | ~56.0.8 | SDK baseline |
| `react-native` | 0.85.3 | Native runtime |
| `expo-dev-client` | ~56.0.18 | **Required** for development builds |
| `expo-font` | ~56.0.5 | Peer dep for `@expo/vector-icons` |
| `@livekit/react-native` | ^2.11.0 | Voice calls (native) |
| `@livekit/react-native-webrtc` | ^144.1.0 | WebRTC native layer |
| `@livekit/react-native-expo-plugin` | ^1.0.2 | Expo config plugin |
| `@config-plugins/react-native-webrtc` | ^15.0.1 | WebRTC permissions + Gradle/Pod setup |
| `livekit-client` | ^2.19.1 | Shared room client (web + native) |
| `expo-camera` | ~56.0.7 | ActiveDate local preview (placeholder video UI) |
| `expo-image-picker` | ~56.0.15 | Profile photos |
| `expo-location` | ~56.0.15 | City/location for matching |
| `@supabase/supabase-js` | ^2.107.0 | Auth + backend |

### Expo Go limitations

| Feature | Expo Go | Dev build |
|---------|---------|-----------|
| Supabase auth / CRUD | Works | Works |
| Queue / pairing / messages | Works | Works |
| **LiveKit voice calls** | **Broken / unavailable** | Works |
| Local camera preview (`expo-camera`) | Works | Works |
| `@livekit/react-native-webrtc` | Not included | Included |

**Rule:** Any tester validating **voice dates** must use a **development build** or **web**.

### Dev build requirements

1. `expo-dev-client` installed (done)
2. Config plugins in `app.json` (done)
3. `index.ts` calls `registerGlobals()` on native (done)
4. `eas.json` with `developmentClient: true` (done)
5. EAS account + project link (you must run)
6. `EXPO_PUBLIC_*` env vars available at **build time** for cloud builds

---

## 2. App configuration audit (`app.json`)

| Field | Value | Status |
|-------|-------|--------|
| `slug` | `speed-spark` | OK |
| `scheme` | `speedspark` | OK — dev client deep links |
| `ios.bundleIdentifier` | `com.speedspark.app` | OK — **change if you own a different domain** |
| `android.package` | `com.speedspark.app` | OK — same note |
| `icon` / adaptive icons | `./assets/*` | OK — files present |
| LiveKit plugin | `audioType: communication` | OK — voice-optimized Android audio |

### Config plugins (order)

1. `expo-image-picker` — photos + camera strings  
2. `expo-location` — when-in-use location  
3. `expo-camera` — camera + mic for date preview UI  
4. `@livekit/react-native-expo-plugin` — LiveKit native setup  
5. `@config-plugins/react-native-webrtc` — WebRTC permissions  
6. `expo-font` — vector icons  

---

## 3. Permissions

### iOS (`Info.plist` — injected by plugins)

| Key | Source | User-facing string |
|-----|--------|-------------------|
| `NSMicrophoneUsageDescription` | `expo-camera` + WebRTC plugin | Mic for dates / WebRTC |
| `NSCameraUsageDescription` | `expo-camera`, `expo-image-picker`, WebRTC | Camera for dates + profile photos |
| `NSPhotoLibraryUsageDescription` | `expo-image-picker` | Profile photo upload |
| `NSLocationWhenInUseUsageDescription` | `expo-location` | City for matching |

All custom strings are set in `app.json` plugin config (not generic defaults).

### Android (manifest — injected by plugins)

| Permission | Source | Used for |
|------------|--------|----------|
| `RECORD_AUDIO` | expo-camera, WebRTC | Voice dates + mic preview |
| `CAMERA` | expo-camera, WebRTC, image-picker | Date preview + profile photos |
| `ACCESS_FINE_LOCATION` / `COARSE` | expo-location | Location picker |
| `INTERNET` | WebRTC plugin | Supabase + LiveKit |
| `MODIFY_AUDIO_SETTINGS` | WebRTC plugin | Call audio routing |
| `BLUETOOTH` | WebRTC plugin | Headset routing |
| `ACCESS_NETWORK_STATE` | WebRTC plugin | Connectivity |
| `WAKE_LOCK` | WebRTC plugin | Active call |

Photo library on Android 13+ uses system picker (no broad storage permission required for typical image-picker flow).

---

## 4. Environment variables (mobile builds)

Set in **project root `.env`** for local Metro, and in **EAS** for cloud builds.

| Variable | Required | Notes |
|----------|----------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | **Yes** | Baked in at build time |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Baked in at build time |
| `EXPO_PUBLIC_PAIRING_INVOKE_SECRET` | **Yes** for auto-pairing | Must match Supabase `PAIRING_CRON_SECRET` |

**Not in app** (Supabase Edge Function secrets only):

- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`

### EAS env setup (cloud builds)

Option A — EAS Secrets (recommended):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --scope project --name EXPO_PUBLIC_PAIRING_INVOKE_SECRET --value "your-secret"
```

Option B — `.env` + EAS env pull (local builds only):

```bash
cp .env.example .env
# fill values
eas env:push --environment development
```

Without these, the dev build launches in **demo mode** (no Supabase).

---

## 5. EAS configuration (`eas.json`)

Profiles defined:

| Profile | Use case |
|---------|----------|
| `development` | Physical device dev client (iOS + Android APK) |
| `development-simulator` | iOS Simulator only (no Apple device UDID) |
| `preview` | Internal distribution without dev menu |
| `production` | Store builds (future) |

---

## 6. Exact commands

### Install EAS CLI

```bash
npm install -g eas-cli
# or
npx eas-cli --version
```

### Log in

```bash
eas login
```

### Configure / link project (first time)

From project root:

```bash
cd "/path/to/Queer Dating App"
eas build:configure
```

This links the repo to an Expo account and confirms `eas.json`. If prompted, create a new EAS project for slug `speed-spark`.

### Set EAS secrets (before cloud build)

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_URL"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY"
eas secret:create --scope project --name EXPO_PUBLIC_PAIRING_INVOKE_SECRET --value "YOUR_PAIRING_SECRET"
```

### iOS development build (physical device)

**Prerequisites:** Apple Developer Program ($99/yr), bundle ID registered.

```bash
eas build --profile development --platform ios
```

When complete, install via QR code / link from EAS dashboard, or:

```bash
eas build:run --profile development --platform ios
```

**iOS Simulator (no paid Apple account for device provisioning):**

```bash
eas build --profile development-simulator --platform ios
```

### Android development build (APK)

No Google Play account required for internal APK.

```bash
eas build --profile development --platform android
```

Download APK from EAS dashboard → install on device (enable “Install unknown apps”).

### Run Metro for dev client

After installing the dev build on device:

```bash
npm run start:dev
# or
npx expo start --dev-client
```

Scan QR or enter URL shown in terminal. Device and computer must reach each other (same Wi‑Fi or tunnel).

---

## 7. Apple Developer setup (iOS)

1. Enroll at [developer.apple.com](https://developer.apple.com) (**Apple Developer Program**).
2. **Certificates, Identifiers & Profiles** → register App ID:
   - Bundle ID: `com.speedspark.app` (or update `app.json` to match your ID)
   - Enable **Push Notifications** later if needed (not required for beta)
3. First EAS iOS build: EAS can manage credentials automatically — choose **Let EAS handle credentials** when prompted.
4. **Physical device testing:** Register device UDID in Apple Developer portal, or let EAS prompt during first internal build.
5. **Export compliance:** App uses encryption (HTTPS) — typically “ exempt ” / standard networking only; answer accordingly in App Store Connect when submitting (not required for ad-hoc dev installs).

---

## 8. Google Play / Android setup

For **closed beta dev APK**, you do **not** need Google Play Console.

| Step | Required for dev APK? |
|------|------------------------|
| Google Play Developer account ($25) | No |
| App signing key | EAS generates / manages |
| Internal testing track | No |
| `android.package` unique globally | Yes — `com.speedspark.app` |

For future Play Store release:

1. Create Play Console app with same `package` name.
2. Use `eas build --profile production --platform android` (AAB).
3. Complete Data safety form (location, photos, mic, camera).

---

## 9. Mobile test plan (dev build)

Complete [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) backend setup first (migrations 001–010, Edge Functions, LiveKit secrets).

Use **two physical devices** or **one device + web** (voice requires native on at least one side for full test).

| # | Flow | Pass criteria |
|---|------|---------------|
| 1 | **Auth** | Email sign-up/in; session persists after kill + reopen |
| 2 | **Photos** | Manage Profile → pick photo → appears after restart |
| 3 | **Queue** | Lobby → join live window → `queue_entries` waiting |
| 4 | **Pairing** | Both paired → ActiveDate within ~30s |
| 5 | **Voice call** | Status **Voice connected**; hear partner (LiveKit) |
| 6 | **Feedback** | Timer end → rating → RPC success |
| 7 | **Match** | Mutual yes → Match Result |
| 8 | **Messages** | Send/receive realtime |

Voice-specific: see [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md) §7.

---

## 10. Build blockers

### Resolved in this audit

| Issue | Fix applied |
|-------|-------------|
| Missing `expo-dev-client` | Installed ~56.0.18 |
| Missing `expo-font` peer dep | Installed ~56.0.5 |
| No `eas.json` | Added with development profiles |
| Missing `bundleIdentifier` / `package` | Set `com.speedspark.app` |
| Missing URL `scheme` | Set `speedspark` |
| Duplicate LiveKit plugin entry | Consolidated to single configured plugin |
| LiveKit Android audio | `audioType: communication` |

### Remaining (you must complete)

| Blocker | Action |
|---------|--------|
| EAS project not linked | Run `eas build:configure` |
| EAS secrets not set | Run `eas secret:create` for 3 `EXPO_PUBLIC_*` vars |
| Apple Developer account | Required for iOS **device** builds |
| Supabase backend | Migrations + Edge Functions per closed beta checklist |
| LiveKit Cloud + Edge Fn secrets | Per LIVEKIT_SETUP.md |
| Bundle ID ownership | Change `com.speedspark.app` if unavailable in Apple/Google |
| **First native build unverified** | Run one EAS build; fix any plugin conflicts if build fails |
| Push notifications | Not implemented — not a build blocker |

### Known non-blockers

| Item | Note |
|------|------|
| Expo Go | Intentionally unsupported for voice |
| DateQueue re-join bug | Product bug, not build |
| Placeholder partner video | Phase 2; camera preview still works |
| No GitHub CI | Optional |

---

## 11. Compatibility notes

- **`@config-plugins/react-native-webrtc@15`** targets modern Expo SDK; compatible with SDK 56 per expo-doctor (21/21 after `expo-font` install).
- **React 19 / RN 0.85** — matches Expo 56 template; no manual native code in repo.
- **New Architecture** — not explicitly enabled; default Expo 56 behavior applies.
- **Hermes** — enabled by default in Expo 56.

---

## 12. Quick reference

```bash
# One-time
npm install -g eas-cli
eas login
eas build:configure
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_PAIRING_INVOKE_SECRET --value "..."

# Build
eas build --profile development --platform ios
eas build --profile development --platform android

# Daily dev
npm run start:dev
```

---

## Related docs

- [LIVEKIT_SETUP.md](./LIVEKIT_SETUP.md) — voice calls + LiveKit secrets  
- [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) — backend + beta go/no-go  
- [supabase/README.md](../supabase/README.md) — database + Edge Functions  
