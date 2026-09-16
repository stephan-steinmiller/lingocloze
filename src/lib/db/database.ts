import type {
	ClozeCard,
	DatabaseShape,
	Deck,
	ReviewGrade,
	ReviewLog,
	Story,
	StoryAttempt,
	StoryQuestion,
	TargetLanguage,
	Word,
	WordSource
} from './types';
import type { ActflLevel } from '$lib/actfl';
import { actflAt, actflBand, actflIndex, actflToStoryLevel, isActflLevel, migrateCefrToActfl } from '$lib/actfl';

const STORAGE_KEY = 'ling_db_v1';

export function uid(prefix = 'id'): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyDb(): DatabaseShape {
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

function load(): DatabaseShape {
	try {
		if (typeof localStorage === 'undefined') return emptyDb();
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return emptyDb();
		const parsed = JSON.parse(raw) as DatabaseShape;
		if (parsed.version !== 1) return emptyDb();
		const db = { ...emptyDb(), ...parsed };
		// Migrate pre-ACTFL CEFR levels (e.g. "B1") forward once, in place.
		let migrated = false;
		for (const l of db.languages) {
			if (!isActflLevel(l.level)) {
				l.level = migrateCefrToActfl(l.level);
				l.storyLevel = actflToStoryLevel(l.level);
				l.updatedAt = Date.now();
				migrated = true;
			}
		}
		for (const d of db.decks) {
			if (!isActflLevel(d.level)) {
				d.level = migrateCefrToActfl(d.level);
				migrated = true;
			}
		}
		if (migrated) save(db);
		return db;
	} catch {
		return emptyDb();
	}
}

function save(db: DatabaseShape): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
	} catch (err) {
		console.warn('[db] persist failed:', err);
	}
}

// ---- Languages -------------------------------------------------------------

export function getLanguages(): TargetLanguage[] {
	return load().languages.sort((a, b) => a.createdAt - b.createdAt);
}

export function getLanguage(id: string): TargetLanguage | undefined {
	return load().languages.find((l) => l.id === id);
}

export function upsertLanguage(lang: TargetLanguage): TargetLanguage {
	const db = load();
	const i = db.languages.findIndex((l) => l.id === lang.id);
	if (i >= 0) db.languages[i] = lang;
	else db.languages.push(lang);
	save(db);
	return lang;
}

export function createLanguage(input: {
	code: string;
	name: string;
	level: TargetLanguage['level'];
	levelScore: number;
}): TargetLanguage {
	const now = Date.now();
	const lang: TargetLanguage = {
		id: input.code,
		code: input.code,
		name: input.name,
		level: input.level,
		levelScore: input.levelScore,
		storyLevel: actflToStoryLevel(input.level),
		knownWordCount: 0,
		createdAt: now,
		updatedAt: now
	};
	return upsertLanguage(lang);
}

export function updateLanguage(
	id: string,
	patch: Partial<TargetLanguage>
): TargetLanguage | undefined {
	const db = load();
	const lang = db.languages.find((l) => l.id === id);
	if (!lang) return undefined;
	Object.assign(lang, patch, { updatedAt: Date.now() });
	save(db);
	return lang;
}

/**
 * Manually set a language's ACTFL sublevel. Score snaps to the band midpoint
 * and story difficulty follows. Used by the manual level control.
 */
export function setLanguageLevel(id: string, level: ActflLevel): TargetLanguage | undefined {
	return updateLanguage(id, {
		level,
		levelScore: actflBand(level).mid,
		storyLevel: actflToStoryLevel(level)
	});
}

/**
 * Promote a language exactly one ACTFL sublevel (no-op at Distinguished).
 * Score starts at the bottom of the new band; story difficulty follows.
 * Used by automatic promotion after the eligibility gate passes.
 */
export function promoteLanguage(id: string): TargetLanguage | undefined {
	const lang = getLanguage(id);
	if (!lang) return undefined;
	const next = actflAt(actflIndex(lang.level) + 1);
	if (next === lang.level) return lang;
	return updateLanguage(id, {
		level: next,
		levelScore: actflBand(next).lo + 1,
		storyLevel: actflToStoryLevel(next)
	});
}

export function deleteLanguage(id: string): void {
	const db = load();
	db.languages = db.languages.filter((l) => l.id !== id);
	const deckIds = new Set(db.decks.filter((d) => d.languageId === id).map((d) => d.id));
	db.decks = db.decks.filter((d) => d.languageId !== id);
	db.cards = db.cards.filter((c) => c.languageId !== id && !deckIds.has(c.deckId));
	db.words = db.words.filter((w) => w.languageId !== id);
	const storyIds = new Set(db.stories.filter((s) => s.languageId === id).map((s) => s.id));
	db.stories = db.stories.filter((s) => s.languageId !== id);
	db.questions = db.questions.filter((q) => !storyIds.has(q.storyId));
	db.attempts = db.attempts.filter((a) => a.languageId !== id);
	db.reviewLogs = db.reviewLogs.filter((l) => l.languageId !== id);
	save(db);
}

// ---- Words -----------------------------------------------------------------

export function getWords(languageId: string): Word[] {
	return load().words.filter((w) => w.languageId === languageId);
}

export function searchWords(languageId: string, query: string): Word[] {
	const q = query.trim().toLowerCase();
	if (!q) return getWords(languageId);
	return getWords(languageId).filter(
		(w) => w.text.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
	);
}

/** Insert or merge a word. Known words checked during onboarding map to proficiency 3+. */
export function upsertWord(input: {
	languageId: string;
	text: string;
	translation: string;
	pos?: string;
	proficiency?: number;
	source?: WordSource;
}): Word {
	const db = load();
	const now = Date.now();
	const key = input.text.trim().toLowerCase();
	const existing = db.words.find(
		(w) => w.languageId === input.languageId && w.text.trim().toLowerCase() === key
	);
	if (existing) {
		existing.translation = input.translation || existing.translation;
		if (input.pos) existing.pos = input.pos;
		if (typeof input.proficiency === 'number') {
			existing.proficiency = Math.max(existing.proficiency, input.proficiency);
		}
		existing.lastSeenAt = now;
		existing.updatedAt = now;
		save(db);
		refreshKnownCount(db, input.languageId);
		return existing;
	}
	const word: Word = {
		id: uid('w'),
		languageId: input.languageId,
		text: input.text.trim(),
		translation: input.translation.trim(),
		pos: input.pos,
		proficiency: input.proficiency ?? 0,
		easeFactor: 2.5,
		interval: 0,
		repetitions: 0,
		dueAt: now,
		lastSeenAt: now,
		source: input.source ?? 'manual',
		createdAt: now,
		updatedAt: now
	};
	db.words.push(word);
	save(db);
	refreshKnownCount(load(), input.languageId);
	return word;
}

export function setWordProficiency(id: string, proficiency: number): Word | undefined {
	const db = load();
	const w = db.words.find((x) => x.id === id);
	if (!w) return undefined;
	w.proficiency = Math.min(5, Math.max(0, proficiency));
	w.updatedAt = Date.now();
	save(db);
	refreshKnownCount(load(), w.languageId);
	return w;
}

function refreshKnownCount(db: DatabaseShape, languageId: string): void {
	const lang = db.languages.find((l) => l.id === languageId);
	if (!lang) return;
	lang.knownWordCount = db.words.filter(
		(w) => w.languageId === languageId && w.proficiency >= 3
	).length;
	lang.updatedAt = Date.now();
	save(db);
}

// ---- Decks & cloze cards ----------------------------------------------------

export function getDecks(languageId?: string): Deck[] {
	const db = load();
	const decks = languageId ? db.decks.filter((d) => d.languageId === languageId) : db.decks;
	return decks.sort((a, b) => b.createdAt - a.createdAt);
}

export function getDeck(id: string): Deck | undefined {
	return load().decks.find((d) => d.id === id);
}

export function createDeck(input: {
	languageId: string;
	title: string;
	topic: string;
	level: Deck['level'];
}): Deck {
	const db = load();
	const deck: Deck = { id: uid('deck'), createdAt: Date.now(), ...input };
	db.decks.push(deck);
	save(db);
	return deck;
}

export function deleteDeck(id: string): void {
	const db = load();
	db.decks = db.decks.filter((d) => d.id !== id);
	db.cards = db.cards.filter((c) => c.deckId !== id);
	save(db);
}

export function getCards(deckId: string): ClozeCard[] {
	const db = load();
	return db.cards.filter((c) => c.deckId === deckId);
}

export function getCardsByLanguage(languageId: string): ClozeCard[] {
	return load().cards.filter((c) => c.languageId === languageId);
}

export function addCards(
	cards: Array<
		Pick<ClozeCard, 'sentence' | 'answer' | 'translation'> &
			Partial<Pick<ClozeCard, 'hint' | 'wordText' | 'wordTranslation'>> & {
				deckId: string;
				languageId: string;
			}
	>
): ClozeCard[] {
	const db = load();
	const now = Date.now();
	const created: ClozeCard[] = cards.map((c) => ({
		id: uid('card'),
		easeFactor: 2.5,
		interval: 0,
		repetitions: 0,
		dueAt: now,
		lastReviewedAt: null,
		lapses: 0,
		createdAt: now,
		hint: c.hint,
		wordText: c.wordText,
		wordTranslation: c.wordTranslation,
		deckId: c.deckId,
		languageId: c.languageId,
		sentence: c.sentence,
		answer: c.answer,
		translation: c.translation
	}));
	db.cards.push(...created);
	save(db);
	// Mirror tested words into the word database as "seen".
	for (const c of created) {
		if (c.wordText) {
			const key = c.wordText.trim().toLowerCase();
			const exists = db.words.some(
				(w) => w.languageId === c.languageId && w.text.trim().toLowerCase() === key
			);
			if (!exists) {
				db.words.push({
					id: uid('w'),
					languageId: c.languageId,
					text: c.wordText.trim(),
					translation: (c.wordTranslation ?? c.answer).trim(),
					proficiency: 1,
					easeFactor: 2.5,
					interval: 0,
					repetitions: 0,
					dueAt: now,
					lastSeenAt: now,
					source: 'cloze',
					createdAt: now,
					updatedAt: now
				});
			}
		}
	}
	save(db);
	return created;
}

export function updateCard(id: string, patch: Partial<ClozeCard>): ClozeCard | undefined {
	const db = load();
	const card = db.cards.find((c) => c.id === id);
	if (!card) return undefined;
	Object.assign(card, patch);
	save(db);
	return card;
}

/** Cards due for review (dueAt <= now), oldest due first. */
export function getDueCards(languageId?: string, deckId?: string, limit = 50): ClozeCard[] {
	const db = load();
	const now = Date.now();
	return db.cards
		.filter(
			(c) =>
				(!languageId || c.languageId === languageId) &&
				(!deckId || c.deckId === deckId) &&
				c.dueAt <= now
		)
		.sort((a, b) => a.dueAt - b.dueAt)
		.slice(0, limit);
}

export function logReview(input: {
	cardId: string;
	languageId: string;
	grade: ReviewGrade;
	correct: boolean;
	durationMs: number;
}): ReviewLog {
	const db = load();
	const log: ReviewLog = { id: uid('log'), timestamp: Date.now(), ...input };
	db.reviewLogs.push(log);
	save(db);
	return log;
}

/** Most recent review logs for a language, newest first. */
export function getReviewLogs(languageId: string, limit = 200): ReviewLog[] {
	return load()
		.reviewLogs.filter((l) => l.languageId === languageId)
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, limit);
}

// ---- Stories ----------------------------------------------------------------

export function getStories(languageId?: string): Story[] {
	const db = load();
	const stories = languageId ? db.stories.filter((s) => s.languageId === languageId) : db.stories;
	return stories.sort((a, b) => b.createdAt - a.createdAt);
}

export function getStory(id: string): Story | undefined {
	return load().stories.find((s) => s.id === id);
}

export function saveStory(
	story: Pick<Story, 'languageId' | 'title' | 'body' | 'topic' | 'level'> &
		Partial<Pick<Story, 'titleTranslation' | 'translation'>>,
	questions: Array<
		Pick<StoryQuestion, 'question' | 'options' | 'correctIndex'> &
			Partial<Pick<StoryQuestion, 'questionTranslation' | 'explanation'>>
	>
): { story: Story; questions: StoryQuestion[] } {
	const db = load();
	const s: Story = { id: uid('story'), createdAt: Date.now(), ...story };
	const qs: StoryQuestion[] = questions.map((q) => ({ id: uid('q'), storyId: s.id, ...q }));
	db.stories.push(s);
	db.questions.push(...qs);
	save(db);
	// Mirror story vocabulary lightly: extract unique long words? No — only track
	// words the quiz explicitly tests via explanations. Keep the word DB clean.
	return { story: s, questions: qs };
}

export function getQuestions(storyId: string): StoryQuestion[] {
	return load().questions.filter((q) => q.storyId === storyId);
}

export function saveAttempt(attempt: Omit<StoryAttempt, 'id' | 'createdAt'>): StoryAttempt {
	const db = load();
	const a: StoryAttempt = { id: uid('att'), createdAt: Date.now(), ...attempt };
	db.attempts.push(a);
	save(db);
	return a;
}

export function getAttempts(storyId?: string): StoryAttempt[] {
	const db = load();
	const list = storyId ? db.attempts.filter((a) => a.storyId === storyId) : db.attempts;
	return list.sort((a, b) => b.createdAt - a.createdAt);
}

// ---- Maintenance ------------------------------------------------------------

export function exportDatabase(): string {
	return JSON.stringify(load(), null, 2);
}

export function importDatabase(json: string): void {
	const parsed = JSON.parse(json) as DatabaseShape;
	if (parsed.version !== 1 || !Array.isArray(parsed.languages)) {
		throw new Error('Unrecognized backup file.');
	}
	save({ ...emptyDb(), ...parsed });
}

export function resetDatabase(): void {
	save(emptyDb());
}

export function dueCount(languageId?: string): number {
	const now = Date.now();
	return load().cards.filter((c) => (!languageId || c.languageId === languageId) && c.dueAt <= now)
		.length;
}
