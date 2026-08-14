# Power Up

Offline-first strength-training PWA. Single user, multi-device sync,
fully usable in a gym with no signal. Scandinavian-minimal, light.

- **Local source of truth:** Dexie (IndexedDB). Every write lands locally
  first; the UI never waits on the network.
- **Sync:** a mutation outbox flushes to Supabase (Postgres, RLS on
  `user_id`) when online. Pull-since-cursor on open/reconnect, merge is
  last-write-wins per record (`updated_at`), deletes are tombstones.
- **Stack:** Vite + React + TypeScript · Tailwind · Framer Motion ·
  Dexie · Supabase · vite-plugin-pwa (Workbox) · hand-rolled SVG charts.

## Local development

```sh
cd power-up
npm install
npm run dev
```

Without Supabase env vars the app runs **local-only** (milestone M1):
everything works, the sync chip is hidden, data stays on-device.

## Supabase setup (multi-device sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. **Schema + RLS:** open the SQL editor and run
   [`supabase/schema.sql`](supabase/schema.sql). It creates the eight
   synced tables (`exercises`, `session_templates`, `template_exercises`,
   `rotation`, `sessions`, `sets`, `body_weight`, `settings`), each with
   `user_id` scoped RLS policies (`user_id = auth.uid()` for select /
   insert / update / delete) and `(user_id, updated_at)` indexes for the
   sync cursor.
3. **Magic-link auth:** in *Authentication → Providers*, make sure
   **Email** is enabled (it is by default; no password needed — the app
   uses `signInWithOtp`). In *Authentication → URL Configuration*, set
   the **Site URL** to your deployed URL (e.g.
   `https://power-up-yourname.vercel.app`) and add it to the redirect
   allow-list. For local dev also add `http://localhost:5173`.
4. **Env vars:** copy the project URL and anon key from
   *Settings → API* into `.env.local`:

   ```sh
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

Then sign in from **Settings → Sync** in the app (magic link). The
session persists — logged-in-but-offline is fully functional, and the
sync chip shows `Synced` / `Offline · n queued`.

## Deploy to Vercel (free tier)

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `power-up` (framework preset: Vite;
   build `npm run build`, output `dist` are auto-detected).
3. Add the two `VITE_SUPABASE_*` environment variables.
4. Deploy, then put the resulting URL into Supabase's Site URL /
   redirect allow-list (step 3 above).

## Install on iPhone

1. Open the deployed URL in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch from the home-screen icon — it runs standalone, works fully
   offline, and syncs when it regains signal.

## Notes

- **Time budget:** `cost = sets × (35 s work + rest) + 60 s transition`,
  superset pairs counted once with combined sets — seeded Session A ≈ 27
  of the 30-minute budget.
- **Progression:** all sets at the top of the rep range → next session
  prefills `+increment_kg` at the bottom of the range. Two consecutive
  sessions without progression → deload banner; accepting prefills −30 %.
- **Two-device merge test:** sign in on two browsers, take one offline
  (devtools → Network → Offline), log sets on both, reconnect — the
  queued writes flush and both converge; conflicting edits to the same
  record resolve to the newest `updated_at`.
- kg only · warm-ups untracked · no phases or week counts anywhere.
