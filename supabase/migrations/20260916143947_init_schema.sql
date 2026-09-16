-- lingocloze initial schema (mirrors src/lib/db/types.ts + sql-schema.ts).
-- Timestamps are epoch-milliseconds BIGINTs to stay 1:1 with the local store
-- (future offline-first sync). IDs are client-generated text keys.
-- RLS is enabled with no policies yet: tables stay locked until auth + RLS
-- policies land with the Supabase client wiring.

create table if not exists public.languages (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  code text not null,
  name text not null,
  level text not null default 'Novice Mid',
  level_score double precision not null default 0,
  story_level double precision not null default 2,
  known_word_count integer not null default 0,
  gentle_mode boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.words (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  language_id text not null references public.languages (id) on delete cascade,
  text text not null,
  translation text not null default '',
  pos text,
  proficiency integer not null default 0,
  ease_factor double precision not null default 2.5,
  srs_interval double precision not null default 0,
  repetitions integer not null default 0,
  due_at bigint not null default 0,
  last_seen_at bigint not null default 0,
  source text not null default 'manual',
  created_at bigint not null,
  updated_at bigint not null
);
create index if not exists idx_words_lang on public.words (language_id);
create index if not exists idx_words_due on public.words (language_id, due_at);
create unique index if not exists idx_words_unique on public.words (language_id, text);

create table if not exists public.decks (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  language_id text not null references public.languages (id) on delete cascade,
  title text not null,
  topic text not null default '',
  level text not null default 'Novice Mid',
  created_at bigint not null
);
create index if not exists idx_decks_lang on public.decks (language_id);

create table if not exists public.cloze_cards (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  deck_id text not null references public.decks (id) on delete cascade,
  language_id text not null references public.languages (id) on delete cascade,
  sentence text not null,
  answer text not null,
  hint text,
  translation text not null default '',
  word_text text,
  word_translation text,
  ease_factor double precision not null default 2.5,
  srs_interval double precision not null default 0,
  repetitions integer not null default 0,
  due_at bigint not null default 0,
  last_reviewed_at bigint,
  lapses integer not null default 0,
  created_at bigint not null
);
create index if not exists idx_cards_deck on public.cloze_cards (deck_id);
create index if not exists idx_cards_due on public.cloze_cards (language_id, due_at);

create table if not exists public.review_logs (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  card_id text not null references public.cloze_cards (id) on delete cascade,
  language_id text not null,
  grade text not null,
  correct boolean not null default false,
  timestamp bigint not null,
  duration_ms integer not null default 0
);
create index if not exists idx_logs_card on public.review_logs (card_id);

create table if not exists public.stories (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  language_id text not null references public.languages (id) on delete cascade,
  title text not null,
  title_translation text,
  body text not null,
  translation text,
  level double precision not null default 2,
  topic text not null default '',
  created_at bigint not null
);
create index if not exists idx_stories_lang on public.stories (language_id);

create table if not exists public.story_questions (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  story_id text not null references public.stories (id) on delete cascade,
  question text not null,
  question_translation text,
  options_json text not null default '[]',
  correct_index integer not null default 0,
  explanation text
);
create index if not exists idx_questions_story on public.story_questions (story_id);

create table if not exists public.story_attempts (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  story_id text not null references public.stories (id) on delete cascade,
  language_id text not null,
  answers_json text not null default '[]',
  score integer not null default 0,
  understood boolean not null default true,
  story_level_after double precision not null default 2,
  created_at bigint not null
);

-- Lock everything down until per-user RLS policies ship with auth wiring.
alter table public.languages enable row level security;
alter table public.words enable row level security;
alter table public.decks enable row level security;
alter table public.cloze_cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.stories enable row level security;
alter table public.story_questions enable row level security;
alter table public.story_attempts enable row level security;
