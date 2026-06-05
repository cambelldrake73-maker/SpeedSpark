# LiveKit voice calls — setup

Phase 1: **voice only** in ActiveDate. Video publishing is Phase 2.

## Requirements

| Platform | Supported | Notes |
|----------|-----------|-------|
| **Web** (`npm run web`) | Yes | Uses `livekit-client` — no dev build required |
| **iOS / Android** | Yes | Requires **EAS development build** — **Expo Go will not work** |
| **Expo Go** | No | Native WebRTC modules not included |

## 1. LiveKit Cloud project

1. Create a project at [livekit.io/cloud](https://livekit.io/cloud).
2. Copy **API Key**, **API Secret**, and **WebSocket URL** (`wss://…livekit.cloud`).
3. Disable recording / egress in project settings (default off).

## 2. Supabase secrets

Set on the Supabase project (Dashboard → Edge Functions → Secrets, or CLI):

```bash
supabase secrets set LIVEKIT_API_KEY=your-api-key
supabase secrets set LIVEKIT_API_SECRET=your-api-secret
supabase secrets set LIVEKIT_URL=wss://your-project.livekit.cloud
```

These values **never** go in the mobile app `.env`.

## 3. Deploy Edge Functions

```bash
supabase functions deploy create-call-room
supabase functions deploy get-call-token
```

Both functions require a **valid user JWT** (default Supabase verify). The app calls them via `supabase.functions.invoke`, which attaches the session automatically.

## 4. Database migration

Run `supabase/migrations/010_speed_date_calls.sql` after `009`.

## 5. Native development build (iOS / Android)

Expo config plugins are already in `app.json`:

- `@livekit/react-native-expo-plugin`
- `@config-plugins/react-native-webrtc`

Create a dev build:

```bash
npm install -g eas-cli
eas login
eas build:configure   # first time only
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

Install the resulting build on test devices. Use `npx expo start --dev-client` to connect Metro.

`index.ts` registers LiveKit globals on native via `registerGlobals()`.

## 6. Web testing (fastest path)

```bash
cp .env.example .env   # Supabase URL + anon key + pairing secret
npm run web
```

Two browser profiles / incognito windows → two accounts → join queue → ActiveDate → allow mic → confirm **Voice connected** status chip.

## 7. End-to-end test

1. Apply migration `010`.
2. Deploy both call Edge Functions with LiveKit secrets.
3. Pair two users (existing queue + pairing flow).
4. Both land on ActiveDate with a real `speedDateId`.
5. Allow microphone on both sides.
6. Status chip: **Voice connected**; partner pane: **On call**.
7. Speak — audio should pass through LiveKit (no video tracks in Phase 1).
8. Timer ends → feedback screen unchanged.
9. Verify `speed_date_calls.status = completed` in Table Editor.

## 8. Logs

Metro / browser console:

```
[SpeedSpark Backend] call.room.joining
[SpeedSpark Backend] call.room.joined
[SpeedSpark Backend] call.room.participant.joined
[SpeedSpark Backend] call.room.left
```

Supabase Edge Function logs:

```
[create-call-room] ok
[get-call-token] issued
[call-room] room created
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `LiveKit is not configured` | Set all three LiveKit secrets on Supabase |
| `Forbidden: not a participant` | User not on the `speed_dates` row or date not `active` |
| `Call has ended` | Token requested after call completed/cancelled |
| Native build crashes on join | Rebuild with dev client after adding LiveKit plugins |
| Web: no audio | Check browser mic permission; use headphones to avoid echo |
| Expo Go | Use dev build or web instead |

## Architecture summary

```
ActiveDate mount
  → create-call-room (Edge Fn, user JWT)
       → LiveKit CreateRoom + speed_date_calls row
  → get-call-token (Edge Fn, user JWT)
       → JWT minted server-side
  → Room.connect(url, token) — audio publish/subscribe only
  → leave on end/block/report → complete_speed_date_call RPC
```

See also: [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md) · [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) · [EAS_BUILD_READINESS.md](./EAS_BUILD_READINESS.md)
