// SQL DDL mirror of src/lib/db/types.ts for @capacitor-community/sqlite.
// v1 ships with a localStorage-backed document store (database.ts) so the web
// build works with zero native setup. When running on a Capacitor native shell
// (or web with the jeep-sqlite web component), call initNativeDatabase() from
// capacitor.ts to create this schema in a real SQLite file ("ling.db").
// A future migration can move the repository layer onto these tables 1:1.

export const SQL_SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS languages (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'A1',
  level_score REAL NOT NULL DEFAULT 0,
  story_level REAL NOT NULL DEFAULT 2,
  known_word_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY NOT NULL,
  language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT '',
  pos TEXT,
  proficiency INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  srs_interval REAL NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_words_lang ON words(language_id);
CREATE INDEX IF NOT EXISTS idx_words_due ON words(language_id, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_words_unique ON words(language_id, text);

CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY NOT NULL,
  language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'A1',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decks_lang ON decks(language_id);

CREATE TABLE IF NOT EXISTS cloze_cards (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  sentence TEXT NOT NULL,
  answer TEXT NOT NULL,
  hint TEXT,
  translation TEXT NOT NULL DEFAULT '',
  word_text TEXT,
  word_translation TEXT,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  srs_interval REAL NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at INTEGER,
  lapses INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cloze_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cloze_cards(language_id, due_at);

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cloze_cards(id) ON DELETE CASCADE,
  language_id TEXT NOT NULL,
  grade TEXT NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0,
  timestamp INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_logs_card ON review_logs(card_id);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY NOT NULL,
  language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_translation TEXT,
  body TEXT NOT NULL,
  translation TEXT,
  level REAL NOT NULL DEFAULT 2,
  topic TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stories_lang ON stories(language_id);

CREATE TABLE IF NOT EXISTS story_questions (
  id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_translation TEXT,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT 0,
  explanation TEXT
);
CREATE INDEX IF NOT EXISTS idx_questions_story ON story_questions(story_id);

CREATE TABLE IF NOT EXISTS story_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  language_id TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '[]',
  score INTEGER NOT NULL DEFAULT 0,
  understood INTEGER NOT NULL DEFAULT 1,
  story_level_after REAL NOT NULL DEFAULT 2,
  created_at INTEGER NOT NULL
);
`;
