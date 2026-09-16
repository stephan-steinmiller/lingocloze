import { generateObject } from 'ai';
import type { ActflLevel } from '$lib/actfl';
import { languageName } from '$lib/db/languages';
import { getLanguageModel, hasApiKey, type BYOKSettings } from './providers';
import {
	clozeSetSchema,
	proficiencySchema,
	storyQuizSchema,
	storySchema,
	vocabListSchema,
	type ClozeCardAI,
	type VocabWordAI
} from './schemas';
import { seedVocab, type ProficiencyResult } from './offline';

export interface ClozeRequest {
	languageCode: string;
	level: ActflLevel;
	topic: string;
	count: number;
	/** Words the user already knows — used to avoid repeats and pitch difficulty */
	knownWords: string[];
}

export interface StoryRequest {
	languageCode: string;
	storyLevel: number; // 1-10
	topic: string;
}

export interface GeneratedStory {
	title: string;
	titleTranslation: string;
	body: string;
	translation: string;
	questions: Array<{
		question: string;
		questionTranslation: string;
		options: string[];
		correctIndex: number;
		explanation?: string;
	}>;
}

function langLabel(code: string): string {
	return languageName(code);
}

/** Demo cards used when no API key is configured (keeps the UI explorable offline). */
function mockCloze(req: ClozeRequest): ClozeCardAI[] {
	const words = ['___'];
	void words;
	const base: Array<[string, string, string]> = [
		['travel', 'viaje', 'trip'],
		['food', 'comida', 'meal'],
		['friend', 'amigo', 'friend'],
		['water', 'agua', 'water'],
		['house', 'casa', 'house'],
		['time', 'tiempo', 'time'],
		['work', 'trabajo', 'work'],
		['day', 'día', 'day'],
		['night', 'noche', 'night'],
		['city', 'ciudad', 'city']
	];
	return Array.from({ length: req.count }, (_, i) => {
		const [en, tgt, gloss] = base[i % base.length];
		return {
			sentence: `(Demo — add an API key for real ${langLabel(req.languageCode)} sentences about “${req.topic}”.) I need ___ for my ${en} plans.`,
			answer: tgt,
			hint: `noun · “${gloss}”`,
			translation: `(Demo) I need ${en} for my ${en} plans.`,
			wordText: tgt,
			wordTranslation: gloss
		};
	});
}

export async function generateClozeCards(
	settings: BYOKSettings,
	req: ClozeRequest
): Promise<{ cards: ClozeCardAI[]; demo: boolean }> {
	const count = Math.min(20, Math.max(1, req.count));
	if (!hasApiKey(settings)) return { cards: mockCloze({ ...req, count }), demo: true };
	const model = getLanguageModel(settings);
	const known = req.knownWords.slice(0, 60).join(', ');
	const { object } = await generateObject({
		model,
		schema: clozeSetSchema,
		prompt: `You are a ${langLabel(req.languageCode)} teacher creating cloze (fill-in-the-blank) flashcards.

Target language: ${langLabel(req.languageCode)} (${req.languageCode})
Learner level: ${req.level} (ACTFL: Novice Low → Novice Mid → Novice High → Intermediate Low/Mid/High → Advanced Low/Mid/High → Superior → Distinguished)
${req.level === 'Novice Low' || req.level === 'Novice Mid' ? 'SURVIVAL MODE: every sentence is 3-7 words, present tense only, concrete everyday vocabulary (prefer cognates and international words), no idioms, no subordinate clauses, one simple idea per sentence.' : ''}
Topic: ${req.topic}
Number of cards: ${count}
${known.length > 0 ? `Words the learner already knows (reuse some, do not test only these): ${known}` : 'No known-words list available.'}

Rules:
- Each sentence is natural ${langLabel(req.languageCode)}, level-appropriate, about the topic.
- Exactly one "___" blank per sentence, testing a single meaningful word (not punctuation).
- Vary grammar: nouns with correct articles/gender, verb conjugations, adjectives, adverbs, prepositions.
- answer = the exact missing word as it appears in the sentence.
- translation = fluent English translation of the full sentence.
- wordText = dictionary/citation form of the tested word when it differs from answer (else = answer).
- Return exactly ${count} cards.`
	});
	return { cards: object.cards.slice(0, count), demo: false };
}

export async function generateVocabChecklist(
	settings: BYOKSettings,
	languageCode: string,
	count = 24
): Promise<{ words: VocabWordAI[]; demo: boolean }> {
	if (!hasApiKey(settings)) {
		const seeds = seedVocab(languageCode, count);
		if (seeds.length >= 8) return { words: seeds, demo: true };
		throw new Error(`No offline vocab list for ${langLabel(languageCode)} — add an API key first.`);
	}
	const model = getLanguageModel(settings);
	const { object } = await generateObject({
		model,
		schema: vocabListSchema,
		prompt: `List ${count} ${langLabel(languageCode)} words for a placement check, ordered from most to least frequent.
- Mix nouns, verbs, adjectives, adverbs across everyday domains.
- tier 1 = top-500 frequency (6 words), tier 2 = top-2000 (6 words), tier 3 = B1-B2 level (6 words), tier 4 = B2-C1 level (6 words).
- Each entry: word in ${langLabel(languageCode)}, short English gloss, part of speech, tier 1-4.`
	});
	return { words: object.words.slice(0, count), demo: false };
}

export async function refineProficiencyWithAI(
	settings: BYOKSettings,
	languageCode: string,
	checklist: VocabWordAI[],
	knownTexts: string[],
	base: ProficiencyResult
): Promise<{ level: ActflLevel; score: number; rationale: string }> {
	if (!hasApiKey(settings)) {
		return {
			...base,
			rationale: `${base.rationale} (Heuristic assessment — add an API key for AI-refined placement.)`
		};
	}
	try {
		const model = getLanguageModel(settings);
		const known = checklist.filter((w) => knownTexts.includes(w.text));
		const unknown = checklist.filter((w) => !knownTexts.includes(w.text));
		const { object } = await generateObject({
			model,
			schema: proficiencySchema,
			prompt: `You place ${langLabel(languageCode)} learners on the ACTFL scale.
Known words (${known.length}): ${known.map((w) => `${w.text} [tier${w.tier}]`).join(', ') || 'none'}
Unknown words (${unknown.length}): ${unknown.map((w) => `${w.text} [tier${w.tier}]`).join(', ') || 'none'}
Heuristic baseline: ${base.level} (${base.score}/100).
Tier 1 words are top-500 frequency, tier 2 top-2000, tier 3 intermediate, tier 4 upper-intermediate.
Return an ACTFL sublevel (Novice Low, Novice Mid, Novice High, Intermediate Low, Intermediate Mid, Intermediate High, Advanced Low, Advanced Mid, Advanced High, Superior, Distinguished), a 0-100 score spread evenly across the 11 sublevels, and one sentence of rationale.`
		});
		return object;
	} catch {
		return {
			...base,
			rationale: `${base.rationale} (AI refinement failed — kept heuristic.)`
		};
	}
}

function mockStory(req: StoryRequest): GeneratedStory {
	return {
		title: `A demo story about ${req.topic}`,
		titleTranslation: `A demo story about ${req.topic}`,
		body: `This is a demo story. Add an API key in Settings to generate real ${langLabel(req.languageCode)} stories at difficulty ${req.storyLevel}/10 about “${req.topic}”.\n\nUntil then, you can still try the quiz flow: read this text, answer the questions, and use the “I did not understand” button to see how difficulty adapts.`,
		translation: 'Demo story translation.',
		questions: [
			{
				question: 'Did you understand this demo story?',
				questionTranslation: 'Did you understand this demo story?',
				options: ['Yes, fully', 'Mostly', 'Only partly', 'Not at all'],
				correctIndex: 3,
				explanation: 'Demo answer — real quizzes test story details.'
			},
			{
				question: 'What should you do next?',
				questionTranslation: 'What should you do next?',
				options: [
					'Add an API key in Settings',
					'Delete the app',
					'Stop learning',
					'Ignore stories'
				],
				correctIndex: 0,
				explanation: 'BYOK: stories are generated with your own key.'
			}
		]
	};
}

export async function generateStory(
	settings: BYOKSettings,
	req: StoryRequest
): Promise<{ story: GeneratedStory; demo: boolean }> {
	if (!hasApiKey(settings)) return { story: mockStory(req), demo: true };
	const model = getLanguageModel(settings);
	const level = Math.min(10, Math.max(1, req.storyLevel));
	const { object: story } = await generateObject({
		model,
		schema: storySchema,
		prompt: `Write a short graded reader story in ${langLabel(req.languageCode)} for a language learner.
Difficulty: ${level}/10 (1 = absolute beginner, short present-tense sentences; 5 = intermediate, past tenses and subordinate clauses; 10 = near-native, idioms and nuance).
Topic: ${req.topic}.
Length: 120-220 words. Simple, engaging plot with a clear ending.
Also translate the title and full story into English. Paragraphs separated by blank lines.`
	});
	const { object: quiz } = await generateObject({
		model,
		schema: storyQuizSchema,
		prompt: `Write 3 reading-comprehension questions for this ${langLabel(req.languageCode)} story. Questions and options in ${langLabel(req.languageCode)} with English translations of each question.

Story:\n${story.body}

Rules:
- Exactly 4 options per question, exactly one correct.
- Test facts, sequence, and one simple inference — not trivia outside the text.
- Keep options similar in length; do not make the correct one obvious.`
	});
	return {
		story: {
			title: story.title,
			titleTranslation: story.titleTranslation,
			body: story.body,
			translation: story.translation,
			questions: quiz.questions
		},
		demo: false
	};
}
