import { z } from 'zod';

export const clozeCardSchema = z.object({
	sentence: z
		.string()
		.describe('A natural sentence in the target language with exactly one "___" blank.'),
	answer: z.string().describe('The missing word that fills the blank (target language).'),
	hint: z
		.string()
		.describe('Short hint (part of speech, article, or infinitive); empty string if none.'),
	translation: z.string().describe('English translation of the full sentence.'),
	wordText: z
		.string()
		.describe('The tested vocabulary word (usually = answer, dictionary form ok).'),
	wordTranslation: z.string().describe('English gloss of the tested word.')
});

export const clozeSetSchema = z.object({
	cards: z.array(clozeCardSchema).min(1).max(20)
});

export const vocabWordSchema = z.object({
	text: z.string().describe('Word in the target language.'),
	translation: z.string().describe('English gloss.'),
	pos: z.string().describe('Short part-of-speech tag, e.g. noun/verb/adj; empty string if unsure.'),
	tier: z.number().int().min(1).max(4).describe('Frequency tier: 1=most common … 4=rarer.')
});

export const vocabListSchema = z.object({
	words: z.array(vocabWordSchema).min(8).max(40)
});

export const proficiencySchema = z.object({
	level: z.enum([
		'Novice Low',
		'Novice Mid',
		'Novice High',
		'Intermediate Low',
		'Intermediate Mid',
		'Intermediate High',
		'Advanced Low',
		'Advanced Mid',
		'Advanced High',
		'Superior',
		'Distinguished'
	]),
	score: z.number().min(0).max(100).describe('Granular 0-100 score across the 11 ACTFL sublevels.'),
	rationale: z.string().describe('One-sentence explanation of the assessment.')
});

export const storySchema = z.object({
	title: z.string().describe('Story title in the target language.'),
	titleTranslation: z.string().describe('English translation of the title.'),
	body: z
		.string()
		.describe(
			'Story text in the target language, 120-220 words, paragraphs separated by blank lines.'
		),
	translation: z.string().describe('English translation of the story.')
});

export const storyQuizSchema = z.object({
	questions: z
		.array(
			z.object({
				question: z.string().describe('Comprehension question in the target language.'),
				questionTranslation: z.string().describe('English translation of the question.'),
				options: z.array(z.string()).length(4).describe('4 answer options in the target language.'),
				correctIndex: z.number().int().min(0).max(3),
				explanation: z.string().describe('Brief explanation in English; empty string if none.')
			})
		)
		.min(2)
		.max(5)
});

export type ClozeCardAI = z.infer<typeof clozeCardSchema>;
export type VocabWordAI = z.infer<typeof vocabWordSchema>;
export type ProficiencyAI = z.infer<typeof proficiencySchema>;
