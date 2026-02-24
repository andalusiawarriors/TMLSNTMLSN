# Cursor prompt: Person 1 – full setup instructions

**Copy everything below the line into Cursor chat (or follow as a checklist).**

---

I need to run the TMLSN app (React Native / Expo) on my machine as Person 1. Do the following and confirm each step.

## 1. Repo and branch

- I'm working in the TMLSNTMLSN repo (or will clone it).
- I'm on **main** and have pulled the latest: `git checkout main && git pull origin main`.

## 2. Dependencies

- Run `npm install` in the project root.
- Confirm no errors.

## 3. Supabase (login & cloud sync)

The app uses a **shared** Supabase project so we all use the same backend.

- **Option A – Config already in repo:**  
  If `lib/supabaseConfig.ts` already has non-empty `SUPABASE_URL` and `SUPABASE_ANON_KEY` (real values, not empty strings), I don't need to do anything for Supabase. Skip to step 4.

- **Option B – I need to set Supabase myself:**  
  1. Copy the env template: `cp .env.local.example .env.local`  
  2. Get the **shared** Supabase Project URL and anon key from the team (or from Supabase Dashboard → Project Settings → API if I have access).  
  3. In `.env.local` set:  
     `EXPO_PUBLIC_SUPABASE_URL=<shared project URL>`  
     `EXPO_PUBLIC_SUPABASE_ANON_KEY=<shared anon key>`  
  4. Restart Expo with a clean cache: `npx expo start --clear`

- **Optional:** If I ever need to run the DB migration (e.g. new tables), run the SQL in `supabase/migrations/001_user_data.sql` in the Supabase SQL Editor. See `docs/SUPABASE_SETUP.md` for details.

## 4. Other env vars (optional)

- In `.env.local` I can add (optional):  
  `FOOD_RECOGNITION_API_KEY`, `CONTENT_API_KEY`, `ANALYTICS_KEY`  
  Only if the team provided them or I need those features.

## 5. Run the app

- Start the dev server: `npm start` or `npx expo start`.
- If I changed `.env.local`, use `npx expo start --clear` so env is picked up.
- Open on simulator/emulator (e.g. press `i` for iOS, `a` for Android) or scan the QR code with Expo Go.

## 6. Verify

- App loads without "Supabase not configured" (Profile → Log in / Create account should work if Supabase is set).
- I can use the nutrition tracker, workout tracker, and prompts tab.

If anything fails, tell me the exact error or screen message and which step I'm on.
