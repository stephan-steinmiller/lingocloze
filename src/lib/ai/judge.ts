import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel, goFlavorFor, hasApiKey, type BYOKSettings } from './providers';

const judgeSchema = z.object({
	accept: z.boolean().describe('True only for minor misspellings or equally correct alternatives.')
});

export interface JudgeInput {
	languageCode: string;
	languageName: string;
	sentence: string;
	expected: string;
	typed: string;
	translation: string;
}

/**
 * Ask the AI whether a non-matching answer is close enough: a minor
 * misspelling (1-2 letters, diacritic/umlaut slip) or an equally correct
 * alternative (accepted synonym, valid spelling variant, fitting inflection).
 * Different words, wrong meanings, or sentence-breaking grammar → false.
 *
 * Cheap by design: boolean-only output, tiny token budget, reasoning kept to
 * a minimum where the provider supports it. Any failure (no key, timeout,
 * API error) degrades to false — i.e. today's strict behavior.
 */
export async function judgeAnswer(settings: BYOKSettings, input: JudgeInput): Promise<boolean> {
	if (!hasApiKey(settings)) return false;
	const typed = input.typed.trim();
	if (!typed || typed.length > 60) return false;
	try {
		const model = getLanguageModel(settings);
		const { object } = await generateObject({
			model,
			schema: judgeSchema,
			prompt: `You grade a fill-in-the-blank flashcard for ${input.languageName} (${input.languageCode}). Reply with the boolean only.
Sentence: "${input.sentence}" (___ marks the blank)
Expected answer: "${input.expected}" (means "${input.translation}")
Learner typed: "${input.typed}"
Accept (true) ONLY for a minor misspelling or an equally correct alternative. Reject (false) different words, wrong meanings, or grammar that breaks the sentence.`,
			maxOutputTokens: 50,
			abortSignal: AbortSignal.timeout(20000),
			providerOptions: reasoningOff(settings.provider, settings.model)
		});
		return object.accept === true;
	} catch {
		return false;
	}
}

/** Minimal-reasoning flags per provider; unknown models get none (safe). */
function reasoningOff(
	provider: BYOKSettings['provider'],
	model: string
): {
	openai?: { reasoningEffort: string };
	anthropic?: { thinking: { type: string } };
	google?: { thinkingConfig: { thinkingBudget: number } };
} {
	if (provider === 'opencode-go') {
		if (goFlavorFor(model) === 'responses') return { openai: { reasoningEffort: 'minimal' } };
		if (goFlavorFor(model) === 'messages') return { anthropic: { thinking: { type: 'disabled' } } };
		return {};
	}
	if (provider === 'anthropic') return { anthropic: { thinking: { type: 'disabled' } } };
	if (provider === 'google') return { google: { thinkingConfig: { thinkingBudget: 0 } } };
	return {};
}
