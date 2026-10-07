# Supabase for lingocloze

Local-first with cloud backup: the app works fully offline in localStorage
(and SQLite on native), and — when logged in — pushes to these Postgres
tables in the background and pulls other-device rows on login. RLS keeps
every row private to its `user_id` owner.

## What's here

- `config.toml` — stock CLI config, project id `ling`.
- `migrations/20260916143947_init_schema.sql` — all 8 domain tables
  (`languages`, `words`, `decks`, `cloze_cards`, `review_logs`, `stories`,
  `story_questions`, `story_attempts`) with `user_id` columns.
- `migrations/20260916212216_rls_owner_policies.sql` — `Owner full access`
  (`auth.uid() = user_id`) on every table.
- `migrations/20260927120000_fix_multitenant.sql` — per-user uniqueness
  (`UNIQUE(user_id, code)`, `UNIQUE(user_id, language_id, lower(text))`),
  owner indexes, idempotent RLS re-creation, explicit grants.

## App wiring (static SPA — no @supabase/ssr)

This app ships with `adapter-static` (no server on surge.sh / Capacitor),
so it uses `@supabase/supabase-js` directly with localStorage sessions
(`flowType: 'pkce'`, `detectSessionInUrl: true`). `@supabase/ssr` is for
cookie-based SSR apps and is deliberately NOT used here.

- `src/lib/stores/auth.svelte.ts` — browser client, OTP + OAuth, PKCE code
  exchange, session listener.
- `src/routes/auth/callback/+page.svelte` — client-only code exchange
  (`/auth/callback?next=/`); works on static hosts.
- `src/lib/db/supabase-sync.ts` — offline-first push/pull (local wins),
  auto-push debounced from `+layout.svelte`, manual `Sync now` in Settings.

## Connect a cloud project

1. Create a project at https://supabase.com/dashboard.
2. `supabase link --project-ref <ref>` (needs `SUPABASE_ACCESS_TOKEN`).
3. `supabase db push` to apply migrations.
4. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY` (publishable key — public by design).

## Auth dashboard checklist (required or login silently fails)

- Auth → URL Configuration → Site URL: your origin (e.g.
  `http://localhost:5173` dev, `https://<you>.surge.sh` prod).
- Auth → URL Configuration → Redirect URLs: allow-list BOTH
  `<origin>/auth/callback` and `<origin>/auth/callback?next=/` patterns
  (Supabase matches exact + wildcard; add `http://localhost:5173/**` for dev
  and `https://<you>.surge.sh/**` for prod).
- Auth → Providers → Email: OTP on (6-digit codes work with no redirect).
- Auth → Providers → Google/GitHub: enable + set provider client IDs if you
  want OAuth (else the login page shows their errors on click).

## Deploy the CORS proxy (AI only, unrelated to sync)

- `supabase functions deploy zen-proxy --project-ref <ref> --no-verify-jwt`
- Paste `https://<ref>.supabase.co/functions/v1/zen-proxy` into the app's
  Settings → provider → "CORS proxy URL" for OpenCode Go on static hosting.
