// Core domain types for the ling language-learning app.
// v1 persistence: localStorage-backed document store (see database.ts).
// The SQL DDL mirror for @capacitor-community/sqlite lives in sql-schema.ts.

import type { ActflLevel } from '$lib/actfl';

/** Proficiency scale: 11 ACTFL sublevels (Novice Low … Distinguished). */
export type ProficiencyLevel = ActflLevel;

export interface TargetLanguage {
	id: string; // e.g. "es" (one entry per language code)
	code: string; // ISO code, e.g. "es"
	name: string; // English display name, e.g. "Spanish"
	level: ProficiencyLevel; // assessed ACTFL sublevel
	levelScore: number; // 0-100 granular score across the 11 sublevels
	/** Continuous story difficulty 1-10, synced from the ACTFL sublevel. */
	storyLevel: number;
	/** Training wheels: show sentence translations while answering reviews. */
	gentleMode?: boolean;
	knownWordCount: number; // cached count of words with proficiency >= 3
	createdAt: number;
	updatedAt: number;
}

export type WordSource = 'onboarding' | 'cloze' | 'story' | 'manual';

export interface Word {
	id: string;
	languageId: string; // TargetLanguage.id
	text: string; // word in target language
	translation: string; // gloss in UI language (English for v1)
	pos?: string; // part of speech hint
	/** 0 = seen only, 1-2 = learning, 3 = known, 4 = strong, 5 = mastered */
	proficiency: number;
	easeFactor: number; // SM-2 EF, default 2.5
	interval: number; // days until next review
	repetitions: number; // consecutive successful recalls
	dueAt: number; // epoch ms
	lastSeenAt: number;
	source: WordSource;
	createdAt: number;
	updatedAt: number;
}

export interface Deck {
	id: string;
	languageId: string;
	title: string;
	topic: string;
	level: ProficiencyLevel;
	createdAt: number;
}

export type ReviewGrade = 'hard' | 'fine' | 'easy';

export interface ClozeCard {
	id: string;
	deckId: string;
	languageId: string;
	/** Sentence with `___` marking the blank */
	sentence: string;
	answer: string;
	hint?: string;
	translation: string; // full sentence translation
	/** The tested word; upserted into the words table on generation */
	wordText?: string;
	wordTranslation?: string;
	easeFactor: number;
	interval: number; // days
	repetitions: number;
	dueAt: number;
	lastReviewedAt: number | null;
	lapses: number;
	createdAt: number;
}

export interface ReviewLog {
	id: string;
	cardId: string;
	languageId: string;
	grade: ReviewGrade;
	correct: boolean; // typed answer matched (case/accent-insensitive)
	timestamp: number;
	durationMs: number;
}

export interface Story {
	id: string;
	languageId: string;
	title: string;
	titleTranslation?: string;
	/** Full story text in the target language (paragraphs separated by \n\n) */
	body: string;
	translation?: string;
	/** Difficulty 1-10 at generation time */
	level: number;
	topic: string;
	createdAt: number;
}

export interface StoryQuestion {
	id: string;
	storyId: string;
	question: string; // in target language
	questionTranslation?: string;
	options: string[]; // 4 options, target language
	correctIndex: number; // 0-3
	explanation?: string;
}

export interface StoryAttempt {
	id: string;
	storyId: string;
	languageId: string;
	/** answers[i] = chosen option index, or -1 for "I did not understand" */
	answers: number[];
	score: number; // 0..questions.length
	understood: boolean; // false if user hit "I did not understand"
	storyLevelAfter: number;
	createdAt: number;
}

export interface DatabaseShape {
	version: 1;
	languages: TargetLanguage[];
	words: Word[];
	decks: Deck[];
	cards: ClozeCard[];
	reviewLogs: ReviewLog[];
	stories: Story[];
	questions: StoryQuestion[];
	attempts: StoryAttempt[];
}
