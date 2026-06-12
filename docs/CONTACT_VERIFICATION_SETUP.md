# Contact verification (SMS, voice call, email)

SpeedSpark sends real 6-digit codes during sign-up / contact verification using **Supabase Edge Functions** plus **Twilio Verify** (SMS + voice call + email) and **Resend** (email fallback).

## What the app does

1. After sign-up (or phone log-in in demo mode), user lands on **Contact verification**.
2. App calls `send-contact-verification` → Twilio sends SMS, places a voice call, or emails a code.
3. User enters the code → app calls `verify-contact-code`.
4. **Call me with the code instead** uses Twilio Verify `channel=call`.

Without provider secrets, Edge Functions return `503`. The app falls back to **demo mode** (any 6 digits) only when Supabase is not configured in `.env`.

## 1. Run migration

In Supabase SQL Editor:

```sql
-- supabase/migrations/011_contact_verification.sql
```

## 2. Twilio Verify (SMS + voice + email)

1. Create a [Twilio](https://www.twilio.com) account.
2. Console → **Verify** → **Services** → Create service (e.g. `SpeedSpark`).
3. Copy **Account SID**, **Auth Token**, and **Verify Service SID**.
4. For SMS/voice: buy or verify a Twilio phone number in Verify settings.
5. For email via Twilio: enable Email in your Verify service (Twilio SendGrid integration).

Set Supabase secrets:

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your-auth-token
supabase secrets set TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxx
```

## 3. Resend (email fallback)

If Twilio email is not enabled, set Resend for email codes:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set RESEND_FROM_EMAIL="SpeedSpark <verify@yourdomain.com>"
```

Use a verified domain/sender in [Resend](https://resend.com).

## 4. Deploy Edge Functions

```bash
supabase functions deploy send-contact-verification
supabase functions deploy verify-contact-code
```

Both use the user's Supabase JWT / anon key (standard `functions.invoke` from the app).

## 5. Local dev without Twilio/Resend

For development only:

```bash
supabase secrets set CONTACT_VERIFY_DEV=true
```

Codes are logged in the Edge Function logs and returned to the app as `devPreviewCode` (shown on screen in dev builds).

**Never enable `CONTACT_VERIFY_DEV` in production.**

## 6. Supabase Auth email (account sign-up)

Account **email + password** sign-up still uses Supabase Auth. If **Confirm email** is enabled in the dashboard, users must confirm that message before a session is created.

Contact verification is a **second step** after account creation to verify the phone number or email they chose in the sign-up wizard.

Recommended for development: **Authentication → Providers → Email → disable Confirm email** so sign-up flows straight into contact verification.

## Rate limits

- Max **5 sends** per destination per hour (database-backed).
- Max **5 verify attempts** per active code.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `Contact verification is not configured` | Set Twilio and/or Resend secrets; redeploy functions |
| SMS never arrives | Check Twilio Verify logs; confirm E.164 phone (+1…) |
| Email in spam | Verify Resend domain; set `RESEND_FROM_EMAIL` |
| Voice call fails | Enable voice in Twilio Verify service |
| Demo mode still active | Ensure `.env` has real `EXPO_PUBLIC_SUPABASE_URL` / anon key (not placeholders) |

See also [supabase/README.md](../supabase/README.md).
