# Supabase for lingocloze

Local-first remains the default; this directory prepares the optional cloud
backend (Postgres mirroring the local store, 1:1 field mapping for future
offline-first sync).

## What's here

- `config.toml` — stock CLI config (`supabase init`), project id `ling`.
- `migrations/20260916143947_init_schema.sql` — all 8 domain tables
  (`languages`, `words`, `decks`, `cloze_cards`, `review_logs`, `stories`,
  `story_questions`, `story_attempts`) with `user_id` columns ready for auth.
  RLS is enabled with **no policies yet** — tables stay locked until the
  auth + client wiring lands.

## Connect a cloud project

1. Create a project at https://supabase.com/dashboard.
2. `supabase link --project-ref <ref>` (needs `SUPABASE_ACCESS_TOKEN`).
3. `supabase db push` to apply the migration (or let a preview branch apply it).
4. To pull an existing DB into migrations: `supabase db pull --db-url <pooler-url>`.

## GitHub integration (branching)

1. Dashboard → Project Settings → Integrations → Authorize GitHub.
2. Pick `stephan-steinmiller/lingocloze`, working directory `.` (repo root,
   since `supabase/` sits at the root).
3. Enable Automatic branching and (recommended) the required migration check.

## Still TODO (app side)

- `@supabase/supabase-js` client + `PUBLIC_SUPABASE_URL/ANON_KEY` wiring.
- Auth (magic link or OAuth) → fill `user_id` on write.
- RLS policies (`auth.uid() = user_id`) + realtime/offline sync queue.
