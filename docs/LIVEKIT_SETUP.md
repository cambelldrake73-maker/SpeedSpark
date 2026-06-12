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

Run `supabase/migrations/010_speed_date_calls.sql` after `009`, then `015_call_orchestration.sql` after `014`.

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

1. Apply migrations `010` and `015`.
2. Deploy both call Edge Functions with LiveKit secrets.
3. Pair two users (existing queue + pairing flow).
4. Both land on ActiveDate with a real `speedDateId`.
5. Allow microphone on both sides.
6. **Timer stays at full duration** until both connect (partner pane: “Waiting for date…”).
7. When both join → timer counts down; status: **Voice connected**.
8. Speak — audio passes through LiveKit (voice-only Phase 1).
9. Timer ends → feedback screen unchanged.
10. **No-show test:** one user joins, wait 45s → joined user returns to lobby (no feedback); `cancel_reason = no_show`.
11. Verify `speed_date_calls.both_joined_at` and `status = completed` after valid dates.

## 8. Logs

Metro / browser console:

```
[SpeedSpark Backend] call.room.joining
[SpeedSpark Backend] call.room.joined
[SpeedSpark Backend] call.room.participant.joined
[SpeedSpark Backend] call.participant.joined.rpc
[SpeedSpark Backend] call.both.joined
[SpeedSpark Backend] call.timer.started
[SpeedSpark Backend] call.no_show.cancelled
[SpeedSpark Backend] call.room.reconnecting
[SpeedSpark Backend] call.room.reconnected
[SpeedSpark Backend] call.completed
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
       → JWT minted server-side (call stays pending until both join)
  → Room.connect(url, token) — audio publish/subscribe only
  → mark_call_participant_joined RPC on connect
  → both joined → timer starts (ActiveDate)
  → leave on end/block/report → complete_call_if_valid / cancel RPCs
```

See also: [VIDEO_INTEGRATION_PLAN.md](./VIDEO_INTEGRATION_PLAN.md) · [CLOSED_BETA_CHECKLIST.md](./CLOSED_BETA_CHECKLIST.md) · [EAS_BUILD_READINESS.md](./EAS_BUILD_READINESS.md)
