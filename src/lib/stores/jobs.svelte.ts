import {
	addCards,
	createDeck,
	getLanguage,
	getWords,
	saveStory,
	uid
} from '$lib/db/database';
import { generateClozeCards, generateStory } from '$lib/ai/generate';
import { loadSettings } from '$lib/ai/providers';
import { touchDb } from './app.svelte';

export type JobKind = 'cloze' | 'story';
export type JobStatus = 'running' | 'done' | 'error';

export interface Job {
	id: string;
	kind: JobKind;
	languageId: string;
	languageName: string;
	topic: string;
	count: number; // cards requested (cloze) or 1 (story)
	status: JobStatus;
	demo: boolean;
	deckId?: string;
	storyId?: string;
	error?: string;
	createdAt: number;
}

// Module-level reactive state: survives client-side navigation, so generation
// keeps running (and reporting) when the user leaves the page.
let jobs = $state<Job[]>([]);

export function getJobs(): Job[] {
	return jobs;
}

export function getJobsFor(kind: JobKind, languageId?: string): Job[] {
	return jobs.filter(
		(j) => j.kind === kind && (!languageId || j.languageId === languageId)
	);
}

export function runningCount(): number {
	return jobs.filter((j) => j.status === 'running').length;
}

export function dismissJob(id: string): void {
	jobs = jobs.filter((j) => j.id !== id);
}

function patch(id: string, p: Partial<Job>): void {
	const job = jobs.find((j) => j.id === id);
	if (job) Object.assign(job, p);
}

function push(job: Job): void {
	jobs = [job, ...jobs].slice(0, 12);
}

function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : 'Generation failed. Check your API key.';
}

/** Enqueue cloze-card generation. Returns immediately; survives navigation. */
export function startClozeJob(input: { languageId: string; topic: string; count: number }): string {
	const lang = getLanguage(input.languageId);
	const id = uid('job');
	push({
		id,
		kind: 'cloze',
		languageId: input.languageId,
		languageName: lang?.name ?? input.languageId,
		topic: input.topic,
		count: Math.min(20, Math.max(1, input.count)),
		status: 'running',
		demo: false,
		createdAt: Date.now()
	});
	void runCloze(id, input);
	return id;
}

async function runCloze(id: string, input: { languageId: string; topic: string; count: number }): Promise<void> {
	try {
		const lang = getLanguage(input.languageId);
		if (!lang) throw new Error('Language was deleted.');
		const known = getWords(lang.id)
			.filter((w) => w.proficiency >= 3)
			.map((w) => w.text);
		const { cards, demo } = await generateClozeCards(loadSettings(), {
			languageCode: lang.code,
			level: lang.level,
			topic: input.topic,
			count: Math.min(20, Math.max(1, input.count)),
			knownWords: known
		});
		const deck = createDeck({
			languageId: lang.id,
			title: `${input.topic} · ${lang.level}`,
			topic: input.topic,
			level: lang.level
		});
		addCards(
			cards.map((c) => ({
				deckId: deck.id,
				languageId: lang.id,
				sentence: c.sentence,
				answer: c.answer,
				translation: c.translation,
				hint: c.hint,
				wordText: c.wordText,
				wordTranslation: c.wordTranslation
			}))
		);
		patch(id, { status: 'done', demo, deckId: deck.id });
		touchDb();
	} catch (err) {
		patch(id, { status: 'error', error: errMsg(err) });
	}
}

/** Enqueue story generation. Returns immediately; survives navigation. */
export function startStoryJob(input: { languageId: string; topic: string }): string {
	const lang = getLanguage(input.languageId);
	const id = uid('job');
	push({
		id,
		kind: 'story',
		languageId: input.languageId,
		languageName: lang?.name ?? input.languageId,
		topic: input.topic,
		count: 1,
		status: 'running',
		demo: false,
		createdAt: Date.now()
	});
	void runStory(id, input);
	return id;
}

async function runStory(id: string, input: { languageId: string; topic: string }): Promise<void> {
	try {
		const lang = getLanguage(input.languageId);
		if (!lang) throw new Error('Language was deleted.');
		const { story, demo } = await generateStory(loadSettings(), {
			languageCode: lang.code,
			storyLevel: lang.storyLevel,
			topic: input.topic
		});
		const saved = saveStory(
			{
				languageId: lang.id,
				title: story.title,
				titleTranslation: story.titleTranslation,
				body: story.body,
				translation: story.translation,
				level: lang.storyLevel,
				topic: input.topic
			},
			story.questions
		);
		patch(id, { status: 'done', demo, storyId: saved.story.id });
		touchDb();
	} catch (err) {
		patch(id, { status: 'error', error: errMsg(err) });
	}
}
