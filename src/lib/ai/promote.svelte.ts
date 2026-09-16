import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguage, getReviewLogs, getWords, promoteLanguage } from '$lib/db/database';
import { promotionEligibility, type ActflLevel } from '$lib/actfl';
import { getLanguageModel, hasApiKey, loadSettings } from './providers';
import { touchDb } from '$lib/stores/app.svelte';

export type PromotionKind = 'assessing' | 'promoted' | 'declined';

export interface PromotionNotice {
	languageId: string;
	from: ActflLevel;
	to: ActflLevel | null;
	kind: PromotionKind;
	rationale: string;
	at: number;
}

// Reactive notice board: pages render the current notice and dismiss it.
let notice = $state<PromotionNotice | null>(null);

export function getPromotionNotice(): PromotionNotice | null {
	return notice;
}

export function clearPromotionNotice(): void {
	notice = null;
}

const inFlight = new Set<string>();
const coolKey = (id: string) => `ling_promo_cool_${id}`;
const COOLDOWN_MS = 7 * 24 * 3600 * 1000;

const confirmSchema = z.object({
	decision: z.enum(['promote', 'wait']),
	rationale: z.string().describe('One sentence justifying the decision.')
});

/**
 * Check promotion eligibility after a review and act on it.
 * - Gates (known words + recall + volume) are deliberately strict: at most one
 *   sublevel per promotion, earned through sustained performance.
 * - Without an API key the heuristic decision stands on its own.
 * - With a key, the AI confirms or vetoes. A veto cools down for 7 days; an
 *   unreachable AI falls back to the earned heuristic promotion.
 * Safe to call after every grade — cheap no-op unless thresholds are crossed.
 */
export async function maybePromote(languageId: string): Promise<void> {
	if (inFlight.has(languageId)) return;
	const lang = getLanguage(languageId);
	if (!lang) return;
	const window = getReviewLogs(languageId, 40).slice(0, 20);
	const correct = window.filter((l) => l.correct).length;
	const elig = promotionEligibility(lang.level, lang.knownWordCount, correct, window.length);
	if (!elig.eligible || !elig.next) return;

	const settings = loadSettings();
	if (!hasApiKey(settings)) {
		promoteLanguage(languageId);
		notice = {
			languageId,
			from: lang.level,
			to: elig.next,
			kind: 'promoted',
			rationale: `Strict gates passed: ${lang.knownWordCount} known words, ${Math.round(elig.recall * 100)}% recall over the last ${window.length} reviews.`,
			at: Date.now()
		};
		touchDb();
		return;
	}

	try {
		const cooled = Number(localStorage.getItem(coolKey(languageId)) ?? 0);
		if (Date.now() - cooled < COOLDOWN_MS) return;
	} catch {
		/* ignore */
	}

	inFlight.add(languageId);
	notice = { languageId, from: lang.level, to: elig.next, kind: 'assessing', rationale: '', at: Date.now() };
	try {
		const sample = getWords(languageId)
			.filter((w) => w.proficiency >= 3)
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, 12)
			.map((w) => w.text);
		const { object } = await generateObject({
			model: getLanguageModel(settings),
			schema: confirmSchema,
			prompt: `You guard level-ups in a language-learning app. Promotion must be EARNED and RARE — when in doubt, say "wait".
Learner: ${lang.name} (${lang.code}), currently ${lang.level}, proposed ${elig.next}.
Evidence: ${lang.knownWordCount} known words (needs ${elig.needWords}); last ${window.length} flashcard reviews: ${correct} recalled correctly (${Math.round(elig.recall * 100)}%, needs ≥80%).
Recently solidified words: ${sample.join(', ') || 'none listed'}.
Reply "promote" ONLY if this evidence clearly supports ${elig.next}-level ability; otherwise "wait". One sentence of rationale either way.`
		});
		if (object.decision === 'promote') {
			promoteLanguage(languageId);
			notice = { languageId, from: lang.level, to: elig.next, kind: 'promoted', rationale: object.rationale, at: Date.now() };
		} else {
			try {
				localStorage.setItem(coolKey(languageId), String(Date.now()));
			} catch {
				/* ignore */
			}
			notice = { languageId, from: lang.level, to: elig.next, kind: 'declined', rationale: object.rationale, at: Date.now() };
		}
	} catch {
		// AI unreachable: honor the earned heuristic promotion instead of blocking it.
		promoteLanguage(languageId);
		notice = {
			languageId,
			from: lang.level,
			to: elig.next,
			kind: 'promoted',
			rationale: 'Strict gates passed (AI confirmation was unreachable, heuristic stands).',
			at: Date.now()
		};
	} finally {
		inFlight.delete(languageId);
		touchDb();
	}
}
