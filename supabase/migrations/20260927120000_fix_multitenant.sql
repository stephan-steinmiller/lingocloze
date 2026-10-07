-- Multitenant hardening: the v1 schema used bare language codes ("es") as
-- public.languages.id and a global UNIQUE(language_id, text) on words.
-- Both collide across users (PK violation on second user's "es", unique
-- violation on same word). The app now generates globally-unique language
-- ids (lang_...) with `code` kept as the ISO code, so:
--   * keep `id` as the global PK (client-generated uid, 1:1 with local store)
--   * scope logical uniqueness per user instead of globally
--   * make RLS policies + grants re-runnable and explicit

-- 1) Per-user logical uniqueness -------------------------------------------
-- One row per (owner, ISO code). Different users may both own "es".
create unique index if not exists idx_languages_user_code
  on public.languages (user_id, code);

-- Words were UNIQUE(language_id, text) globally: user B could not save a
-- word user A already had in the same language. Scope to the owner and
-- match the app's case-insensitive merge (lower(text)).
drop index if exists public.idx_words_unique;
create unique index if not exists idx_words_unique_user
  on public.words (user_id, language_id, lower(text));

-- 2) Owner lookup indexes (RLS `auth.uid() = user_id` + sync pulls) --------
create index if not exists idx_languages_user on public.languages (user_id);
create index if not exists idx_words_user on public.words (user_id);
create index if not exists idx_decks_user on public.decks (user_id);
create index if not exists idx_cards_user on public.cloze_cards (user_id);
create index if not exists idx_logs_user on public.review_logs (user_id);
create index if not exists idx_stories_user on public.stories (user_id);
create index if not exists idx_questions_user on public.story_questions (user_id);
create index if not exists idx_attempts_user on public.story_attempts (user_id);

-- 3) RLS policies (idempotent re-creation) ----------------------------------
-- Every row belongs to exactly one auth user via user_id. Anonymous rows
-- (null user_id) stay invisible to everyone.
do $$
declare
  t text;
begin
  foreach t in array array[
    'languages', 'words', 'decks', 'cloze_cards',
    'review_logs', 'stories', 'story_questions', 'story_attempts'
  ]
  loop
    execute format('drop policy if exists "Owner full access" on public.%I', t);
    execute format(
      'create policy "Owner full access" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end
$$;

-- 4) Explicit grants (Supabase auto-exposes new tables, but be explicit so
-- a fresh `db push` never leaves tables unreachable behind RLS) -------------
grant usage on schema public to anon, authenticated, service_role;
grant all on public.languages to authenticated, service_role;
grant all on public.words to authenticated, service_role;
grant all on public.decks to authenticated, service_role;
grant all on public.cloze_cards to authenticated, service_role;
grant all on public.review_logs to authenticated, service_role;
grant all on public.stories to authenticated, service_role;
grant all on public.story_questions to authenticated, service_role;
grant all on public.story_attempts to authenticated, service_role;
