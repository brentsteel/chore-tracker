# Chore Tracker

A mobile-friendly household chore tracker built with React + Vite, backed by
Supabase for shared data and per-person logins.

## How it works now

- **Data** lives in a Supabase Postgres database (free, doesn't expire) instead
  of the browser's local storage — so every device sees the same rooms,
  chores, and history, live.
- **Logins** are per-person via Supabase Auth (email + password). Everyone in
  the house signs up with their own email once, then signs in on each device.
  Once signed in, everyone sees and can edit the same shared list — there's
  no per-person separation of data, just per-person identity (so the history
  log can show who did what).
- The app hosting itself (Render static site) doesn't change.

## One-time setup

### 1. Create a Supabase project

1. Go to https://supabase.com → **New project** (free tier)
2. Once it's created, go to **SQL Editor** → **New query**
3. Paste the contents of `supabase-schema.sql` (included in this project) and
   run it. This creates the `rooms`, `chores`, and `completions` tables, sets
   up row-level security so only signed-in users can read/write, and turns
   on realtime sync.
4. Go to **Project Settings → API**. You'll need:
   - **Project URL**
   - **anon public** key
   (Both are safe to expose in frontend code — row-level security is what
   actually protects the data, not secrecy of these values.)

### 2. Optional: turn off email confirmation for a smoother family sign-up

By default Supabase requires confirming a sign-up via email link. For a
household app this is usually fine to leave on, but if you'd rather everyone
can sign up and start immediately: **Authentication → Providers → Email** →
turn off "Confirm email".

### 3. Configure the app with your Supabase credentials

Create a `.env` file in the project root (copy `.env.example`) and fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## Deploy to Render

1. **Put this project on GitHub** (if it's already there from before, just
   commit these changes — see "What to update" below)

2. **Static Site settings on Render**
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

3. **Add the environment variables in Render** (this is the important new
   step): in your Render service → **Environment** → add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Vite bakes these into the build at build time, so they must be set in
   Render's environment before it runs `npm run build`, not just locally.

4. Trigger a deploy (push to GitHub, or **Manual Deploy** in Render).

## Inviting your kids

Once it's live, send them the URL and have each of them tap **Sign up**,
enter their name, email, and a password. That's it — they'll land straight
in the shared chore list.

## Run locally (optional)

```
npm install
npm run dev
```

Then open the local URL it prints (usually http://localhost:5173). Make sure
your `.env` file is filled in first.
