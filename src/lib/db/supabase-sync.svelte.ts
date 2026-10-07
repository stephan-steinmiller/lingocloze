import type { SupabaseClient } from '@supabase/supabase-js';
import type {
	ClozeCard,
	DatabaseShape,
	Deck,
	ReviewLog,
	Story,
	StoryAttempt,
	StoryQuestion,
	TargetLanguage,
	Word
} from './types';
import { exportDatabase, importDatabase } from './database';
import { getSupabase, getUser, isSupabaseConfigured } from '$lib/stores/auth.svelte';

// ---- Remote row shapes (snake_case, 1:1 with supabase/migrations) ----------

interface LanguageRow {
	id: string;
	user_id: string;
	code: string;
	name: string;
	level: string;
	level_score: number;
	story_level: number;
	known_word_count: number;
	gentle_mode: boolean | null;
	created_at: number;
	updated_at: number;
}

interface WordRow {
	id: string;
	user_id: string;
	language_id: string;
	text: string;
	translation: string;
	pos: string | null;
	proficiency: number;
	ease_factor: number;
	srs_interval: number;
	repetitions: number;
	due_at: number;
	last_seen_at: number;
	source: string;
	created_at: number;
	updated_at: number;
}

interface DeckRow {
	id: string;
	user_id: string;
	language_id: string;
	title: string;
	topic: string;
	level: string;
	created_at: number;
}

interface CardRow {
	id: string;
	user_id: string;
	deck_id: string;
	language_id: string;
	sentence: string;
	answer: string;
	hint: string | null;
	translation: string;
	word_text: string | null;
	word_translation: string | null;
	ease_factor: number;
	srs_interval: number;
	repetitions: number;
	due_at: number;
	last_reviewed_at: number | null;
	lapses: number;
	created_at: number;
}

interface LogRow {
	id: string;
	user_id: string;
	card_id: string;
	language_id: string;
	grade: string;
	correct: boolean;
	timestamp: number;
	duration_ms: number;
}

interface StoryRow {
	id: string;
	user_id: string;
	language_id: string;
	title: string;
	title_translation: string | null;
	body: string;
	translation: string | null;
	level: number;
	topic: string;
	created_at: number;
}

interface QuestionRow {
	id: string;
	user_id: string;
	story_id: string;
	question: string;
	question_translation: string | null;
	options_json: string;
	correct_index: number;
	explanation: string | null;
}

interface AttemptRow {
	id: string;
	user_id: string;
	story_id: string;
	language_id: string;
	answers_json: string;
	score: number;
	understood: boolean;
	story_level_after: number;
	created_at: number;
}

// ---- Sync status (reactive, read from Settings UI) -------------------------

let syncing = $state(false);
let lastSyncAt = $state<number | null>(
	typeof localStorage !== 'undefined'
		? Number(localStorage.getItem('ling_sync_at') ?? 0) || null
		: null
);
let lastError = $state('');

export function isSyncing(): boolean {
	return syncing;
}
export function getLastSyncAt(): number | null {
	return lastSyncAt;
}
export function getSyncError(): string {
	return lastError;
}

function setLastSync(now: number): void {
	lastSyncAt = now;
	try {
		localStorage.setItem('ling_sync_at', String(now));
	} catch {
		/* ignore */
	}
}

/** Cloud sync needs env + a logged-in user (RLS is per-user). */
export function isCloudSyncAvailable(): boolean {
	return isSupabaseConfigured() && !!getUser()?.id;
}

function authed(sb: SupabaseClient | null): { sb: SupabaseClient; uid: string } | null {
	const uid = getUser()?.id;
	if (!sb || !uid) return null;
	return { sb, uid };
}

// ---- Mappers (local <-> remote) --------------------------------------------

const toLangRow = (l: TargetLanguage, uid: string): LanguageRow => ({
	id: l.id,
	user_id: uid,
	code: l.code,
	name: l.name,
	level: l.level,
	level_score: l.levelScore,
	story_level: l.storyLevel,
	known_word_count: l.knownWordCount,
	gentle_mode: l.gentleMode ?? false,
	created_at: l.createdAt,
	updated_at: l.updatedAt
});

const fromLangRow = (r: LanguageRow): TargetLanguage => ({
	id: r.id,
	code: r.code,
	name: r.name,
	level: r.level as TargetLanguage['level'],
	levelScore: r.level_score,
	storyLevel: r.story_level,
	gentleMode: r.gentle_mode ?? undefined,
	knownWordCount: r.known_word_count,
	createdAt: r.created_at,
	updatedAt: r.updated_at
});

const toWordRow = (w: Word, uid: string): WordRow => ({
	id: w.id,
	user_id: uid,
	language_id: w.languageId,
	text: w.text,
	translation: w.translation,
	pos: w.pos ?? null,
	proficiency: w.proficiency,
	ease_factor: w.easeFactor,
	srs_interval: w.interval,
	repetitions: w.repetitions,
	due_at: w.dueAt,
	last_seen_at: w.lastSeenAt,
	source: w.source,
	created_at: w.createdAt,
	updated_at: w.updatedAt
});

const fromWordRow = (r: WordRow): Word => ({
	id: r.id,
	languageId: r.language_id,
	text: r.text,
	translation: r.translation,
	pos: r.pos ?? undefined,
	proficiency: r.proficiency,
	easeFactor: r.ease_factor,
	interval: r.srs_interval,
	repetitions: r.repetitions,
	dueAt: r.due_at,
	lastSeenAt: r.last_seen_at,
	source: (r.source as Word['source']) ?? 'manual',
	createdAt: r.created_at,
	updatedAt: r.updated_at
});

const toDeckRow = (d: Deck, uid: string): DeckRow => ({
	id: d.id,
	user_id: uid,
	language_id: d.languageId,
	title: d.title,
	topic: d.topic,
	level: d.level,
	created_at: d.createdAt
});

const fromDeckRow = (r: DeckRow): Deck => ({
	id: r.id,
	languageId: r.language_id,
	title: r.title,
	topic: r.topic,
	level: r.level as Deck['level'],
	createdAt: r.created_at
});

const toCardRow = (c: ClozeCard, uid: string): CardRow => ({
	id: c.id,
	user_id: uid,
	deck_id: c.deckId,
	language_id: c.languageId,
	sentence: c.sentence,
	answer: c.answer,
	hint: c.hint ?? null,
	translation: c.translation,
	word_text: c.wordText ?? null,
	word_translation: c.wordTranslation ?? null,
	ease_factor: c.easeFactor,
	srs_interval: c.interval,
	repetitions: c.repetitions,
	due_at: c.dueAt,
	last_reviewed_at: c.lastReviewedAt,
	lapses: c.lapses,
	created_at: c.createdAt
});

const fromCardRow = (r: CardRow): ClozeCard => ({
	id: r.id,
	deckId: r.deck_id,
	languageId: r.language_id,
	sentence: r.sentence,
	answer: r.answer,
	hint: r.hint ?? undefined,
	translation: r.translation,
	wordText: r.word_text ?? undefined,
	wordTranslation: r.word_translation ?? undefined,
	easeFactor: r.ease_factor,
	interval: r.srs_interval,
	repetitions: r.repetitions,
	dueAt: r.due_at,
	lastReviewedAt: r.last_reviewed_at,
	lapses: r.lapses,
	createdAt: r.created_at
});

const toLogRow = (l: ReviewLog, uid: string): LogRow => ({
	id: l.id,
	user_id: uid,
	card_id: l.cardId,
	language_id: l.languageId,
	grade: l.grade,
	correct: l.correct,
	timestamp: l.timestamp,
	duration_ms: l.durationMs
});

const fromLogRow = (r: LogRow): ReviewLog => ({
	id: r.id,
	cardId: r.card_id,
	languageId: r.language_id,
	grade: r.grade as ReviewLog['grade'],
	correct: r.correct,
	timestamp: r.timestamp,
	durationMs: r.duration_ms
});

const toStoryRow = (s: Story, uid: string): StoryRow => ({
	id: s.id,
	user_id: uid,
	language_id: s.languageId,
	title: s.title,
	title_translation: s.titleTranslation ?? null,
	body: s.body,
	translation: s.translation ?? null,
	level: s.level,
	topic: s.topic,
	created_at: s.createdAt
});

const fromStoryRow = (r: StoryRow): Story => ({
	id: r.id,
	languageId: r.language_id,
	title: r.title,
	titleTranslation: r.title_translation ?? undefined,
	body: r.body,
	translation: r.translation ?? undefined,
	level: r.level,
	topic: r.topic,
	createdAt: r.created_at
});

const toQuestionRow = (q: StoryQuestion, uid: string): QuestionRow => ({
	id: q.id,
	user_id: uid,
	story_id: q.storyId,
	question: q.question,
	question_translation: q.questionTranslation ?? null,
	options_json: JSON.stringify(q.options),
	correct_index: q.correctIndex,
	explanation: q.explanation ?? null
});

function fromQuestionRow(r: QuestionRow): StoryQuestion {
	let options: string[] = [];
	try {
		const parsed: unknown = JSON.parse(r.options_json);
		if (Array.isArray(parsed)) options = parsed.map(String);
	} catch {
		options = [];
	}
	return {
		id: r.id,
		storyId: r.story_id,
		question: r.question,
		questionTranslation: r.question_translation ?? undefined,
		options,
		correctIndex: r.correct_index,
		explanation: r.explanation ?? undefined
	};
}

const toAttemptRow = (a: StoryAttempt, uid: string): AttemptRow => ({
	id: a.id,
	user_id: uid,
	story_id: a.storyId,
	language_id: a.languageId,
	answers_json: JSON.stringify(a.answers),
	score: a.score,
	understood: a.understood,
	story_level_after: a.storyLevelAfter,
	created_at: a.createdAt
});

function fromAttemptRow(r: AttemptRow): StoryAttempt {
	let answers: number[] = [];
	try {
		const parsed: unknown = JSON.parse(r.answers_json);
		if (Array.isArray(parsed)) answers = parsed.map(Number);
	} catch {
		answers = [];
	}
	return {
		id: r.id,
		storyId: r.story_id,
		languageId: r.language_id,
		answers,
		score: r.score,
		understood: r.understood,
		storyLevelAfter: r.story_level_after,
		createdAt: r.created_at
	};
}

// ---- Low-level helpers ------------------------------------------------------

async function fetchAll<T>(sb: SupabaseClient, table: string, uid: string): Promise<T[]> {
	// PostgREST max_rows caps pages at 1000: paginate until short.
	const out: T[] = [];
	let from = 0;
	const PAGE = 900;
	for (;;) {
		const { data, error } = await sb
			.from(table)
			.select('*')
			.eq('user_id', uid)
			.range(from, from + PAGE - 1);
		if (error) throw error;
		const rows = (data ?? []) as T[];
		out.push(...rows);
		if (rows.length < PAGE) break;
		from += PAGE;
		if (from > 10000) break; // sanity cap for v1
	}
	return out;
}

async function upsertAll(sb: SupabaseClient, table: string, rows: object[]): Promise<void> {
	// Push parents before children (see syncNow order); chunk for payload size.
	const CHUNK = 200;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const chunk = rows.slice(i, i + CHUNK);
		const { error } = await sb.from(table).upsert(chunk, { onConflict: 'id' });
		if (error) throw error;
	}
}

function localSnapshot(): DatabaseShape {
	try {
		return JSON.parse(exportDatabase()) as DatabaseShape;
	} catch {
		return {
			version: 1,
			languages: [],
			words: [],
			decks: [],
			cards: [],
			reviewLogs: [],
			stories: [],
			questions: [],
			attempts: []
		};
	}
}

// ---- Public sync API --------------------------------------------------------

/**
 * Push the whole local per-account store to Supabase (upsert, local wins).
 * Parents first so FKs (decks→languages, cards→decks, …) never violate.
 */
export async function pushLocal(): Promise<void> {
	const ctx = authed(getSupabase());
	if (!ctx) throw new Error('Cloud sync needs login + Supabase env.');
	const db = localSnapshot();
	const { sb, uid } = ctx;
	await upsertAll(
		sb,
		'languages',
		db.languages.map((l) => toLangRow(l, uid))
	);
	await upsertAll(
		sb,
		'decks',
		db.decks.map((d) => toDeckRow(d, uid))
	);
	await upsertAll(
		sb,
		'stories',
		db.stories.map((s) => toStoryRow(s, uid))
	);
	await upsertAll(
		sb,
		'words',
		db.words.map((w) => toWordRow(w, uid))
	);
	await upsertAll(
		sb,
		'cloze_cards',
		db.cards.map((c) => toCardRow(c, uid))
	);
	await upsertAll(
		sb,
		'story_questions',
		db.questions.map((q) => toQuestionRow(q, uid))
	);
	await upsertAll(
		sb,
		'review_logs',
		db.reviewLogs.map((l) => toLogRow(l, uid))
	);
	await upsertAll(
		sb,
		'story_attempts',
		db.attempts.map((a) => toAttemptRow(a, uid))
	);
}

/**
 * Pull the remote per-user store and union it into the local store.
 * Local wins on id conflicts (SRS progress is never clobbered by a stale
 * remote row); remote-only rows (other device) are added. Returns true when
 * the local store gained rows.
 */
export async function pullRemote(): Promise<boolean> {
	const ctx = authed(getSupabase());
	if (!ctx) throw new Error('Cloud sync needs login + Supabase env.');
	const { sb, uid } = ctx;
	const [langRows, deckRows, storyRows, wordRows, cardRows, qRows, logRows, attRows] =
		await Promise.all([
			fetchAll<LanguageRow>(sb, 'languages', uid),
			fetchAll<DeckRow>(sb, 'decks', uid),
			fetchAll<StoryRow>(sb, 'stories', uid),
			fetchAll<WordRow>(sb, 'words', uid),
			fetchAll<CardRow>(sb, 'cloze_cards', uid),
			fetchAll<QuestionRow>(sb, 'story_questions', uid),
			fetchAll<LogRow>(sb, 'review_logs', uid),
			fetchAll<AttemptRow>(sb, 'story_attempts', uid)
		]);
	const local = localSnapshot();
	// Plain lookup objects (not Svelte state — this is one-shot sync logic,
	// so SvelteSet/SvelteMap reactivity is unnecessary).
	const known: Record<string, Record<string, true>> = {
		languages: Object.fromEntries(local.languages.map((l) => [l.id, true])),
		decks: Object.fromEntries(local.decks.map((d) => [d.id, true])),
		stories: Object.fromEntries(local.stories.map((s) => [s.id, true])),
		words: Object.fromEntries(local.words.map((w) => [w.id, true])),
		cards: Object.fromEntries(local.cards.map((c) => [c.id, true])),
		questions: Object.fromEntries(local.questions.map((q) => [q.id, true])),
		logs: Object.fromEntries(local.reviewLogs.map((l) => [l.id, true])),
		attempts: Object.fromEntries(local.attempts.map((a) => [a.id, true]))
	};

	let added = false;
	for (const r of langRows) {
		if (known.languages[r.id]) continue;
		// Same ISO code under a different id (legacy "es" vs new uid):
		// keep the local row, skip the remote twin to preserve FK refs.
		if (local.languages.some((l) => l.code === r.code)) continue;
		local.languages.push(fromLangRow(r));
		added = true;
	}
	for (const r of deckRows) {
		if (!known.decks[r.id]) {
			local.decks.push(fromDeckRow(r));
			added = true;
		}
	}
	for (const r of storyRows) {
		if (!known.stories[r.id]) {
			local.stories.push(fromStoryRow(r));
			added = true;
		}
	}
	for (const r of wordRows) {
		if (!known.words[r.id]) {
			local.words.push(fromWordRow(r));
			added = true;
		}
	}
	for (const r of cardRows) {
		if (!known.cards[r.id]) {
			local.cards.push(fromCardRow(r));
			added = true;
		}
	}
	for (const r of qRows) {
		if (!known.questions[r.id]) {
			local.questions.push(fromQuestionRow(r));
			added = true;
		}
	}
	for (const r of logRows) {
		if (!known.logs[r.id]) {
			local.reviewLogs.push(fromLogRow(r));
			added = true;
		}
	}
	for (const r of attRows) {
		if (!known.attempts[r.id]) {
			local.attempts.push(fromAttemptRow(r));
			added = true;
		}
	}
	if (added) importDatabase(JSON.stringify({ ...local, version: 1 }));
	return added;
}

/**
 * Full round-trip: push local → pull remote → merge (local wins).
 * Safe to call on login, on "Sync now", and debounced after edits.
 */
export async function syncNow(): Promise<{ pushed: boolean; pulled: boolean }> {
	if (!isCloudSyncAvailable()) throw new Error('Log in to sync.');
	if (syncing) return { pushed: false, pulled: false };
	syncing = true;
	lastError = '';
	try {
		await pushLocal();
		const pulled = await pullRemote();
		setLastSync(Date.now());
		return { pushed: true, pulled };
	} catch (err) {
		lastError = err instanceof Error ? err.message : 'Sync failed.';
		throw err;
	} finally {
		syncing = false;
	}
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced background push (call after local mutations via layout). */
export function schedulePush(delayMs = 2500): void {
	if (!isCloudSyncAvailable()) return;
	if (pushTimer) clearTimeout(pushTimer);
	pushTimer = setTimeout(() => {
		pushTimer = null;
		pushLocal()
			.then(() => setLastSync(Date.now()))
			.catch((err: unknown) => {
				lastError = err instanceof Error ? err.message : 'Sync failed.';
			});
	}, delayMs);
}
