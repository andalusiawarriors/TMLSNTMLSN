# Supabase Setup for TMLSN Auth & Cloud Storage

This guide explains how to configure Supabase for login, account creation, and per-account cloud storage.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in or create an account.
2. Create a new project (e.g. `tmlsn-app`).
3. Wait for the project to finish provisioning.

## 2. Run the Migration

1. In the Supabase dashboard, open **SQL Editor**.
2. Create a new query and paste the contents of `supabase/migrations/001_user_data.sql`.
3. Run the query to create the tables and RLS policies.

## 3. Configure Auth (optional)

By default, Supabase requires email confirmation for new signups. To allow immediate sign-in without email confirmation:

1. Go to **Authentication** → **Providers** → **Email**.
2. Turn off **Confirm email** if you want users to be signed in immediately after creating an account.

## 4. Add Environment Variables

Add these to your `.env.local` (or copy from `.env.local.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Find these values in Supabase: **Project Settings** → **API** → Project URL and anon public key.

## 5. Restart the App

Restart Expo so it picks up the new env vars. Users can then:

1. Open the **Profile** sheet (profile pill in the tab bar).
2. Tap **Log in / Create account**.
3. Choose **Create account** or **Log in**.
4. Enter email and password.

Once signed in, all nutrition logs, workouts, prompts, saved foods, routines, and settings are stored in Supabase per account and sync across devices.
