# Speed Spark — Queer Dating App MVP

A free-first, profile-based queer dating app built around scheduled 5-minute voice/video speed dates.

## Vision

Speed Spark addresses common dating app problems: expensive upgrades, shallow swiping, bad matching pools, and poor fit for queer dating. The app is identity-verified, preference-aware, and centered on real-time connection — not endless profiles.

## Tech Stack

- **React Native** with **Expo** (~SDK 56)
- **TypeScript**
- **React Navigation** (native stack)
- **Supabase** (auth + Postgres + storage) — client wired; run migration to activate

## Getting Started

```bash
npm install
cp .env.example .env   # optional — add Supabase keys to enable real auth
npm start              # Expo dev server
npm run web            # Open in browser
```

**Without `.env`:** full demo mode with mock data.  
**With Supabase keys:** email sign-up/login and profile save hit the database.

See **[supabase/README.md](supabase/README.md)** for project setup and running the SQL migration.

Then press `i` for iOS simulator, `a` for Android emulator, `w` for web, or scan the QR code with Expo Go.

**Demo paths:**
- Full onboarding: Welcome → Sign up → Profile → Preferences → Verification → Lobby
- Quick demo: Welcome → Log in (any email) → Lobby → Join queue → Date → Feedback

## Project Structure

```
src/
├── components/       # Reusable UI (Button, Input, TagSelector, etc.)
├── constants/        # Theme tokens and profile option lists
├── context/          # App-wide state (profile, onboarding, date flow)
├── data/             # Mock users, messages, speed date windows
├── navigation/       # Stack navigator and route types
├── screens/          # All 10 MVP screens
├── services/         # Supabase placeholder (future backend)
└── types/            # Shared TypeScript interfaces
```

## Screens

| # | Screen | Purpose |
|---|--------|---------|
| 1 | Welcome | App intro and value proposition |
| 2 | Auth | Sign up / log in (mock) |
| 3 | Profile Creation | Name, photos, identity, queer prefs |
| 4 | Preferences | Age, distance, matching filters |
| 5 | Verification | Identity verify placeholder |
| 6 | Speed Date Lobby | Join queue during live windows |
| 7 | Active Date | 5-min call placeholder with timer |
| 8 | Post-Date Feedback | Private survey after each date |
| 9 | Match Result | Mutual match reveal |
| 10 | Messages | Basic chat with matches |

## User Flow

```
Welcome → Auth → Profile → Preferences → Verification → Lobby
  → Queue → Active Date → Feedback → Match Result → Messages
```

**Quick demo path:** Log in from the Auth screen to skip onboarding and jump straight to the lobby.

## What's Included (MVP)

- Full onboarding flow with queer-specific profile fields
- Scheduled speed date windows with mock queue matching
- 5-minute date timer (placeholder video UI)
- Private post-date feedback with mutual match logic
- Basic messaging with mock data
- Private attractiveness balance concept (documented, not displayed)

## Not Yet Built

- Phone OTP via Supabase (still demo flow)
- Photo storage upload pipeline
- Identity verification (selfie match)
- Voice/video calls (WebRTC or third-party SDK)
- Payments / premium tiers
- Push notifications
- Real matching algorithm / live queue pairing

## Supabase

The app includes `@supabase/supabase-js`, an initial schema in `supabase/migrations/`, and services in `src/services/`.

```bash
cp .env.example .env
# Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Apply `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor. Full steps: **[supabase/README.md](supabase/README.md)**.

## Branding

The app is branded **Speed Spark** — see `src/constants/theme.ts` (`brand`) for the single source of truth.
