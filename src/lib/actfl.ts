/**
 * ACTFL proficiency scale: Novice / Intermediate / Advanced (Low/Mid/High)
 * + Superior + Distinguished = 11 sublevels for fine-grained assessment.
 * (Replaces the coarser 6-level CEFR scale previously used.)
 */

export const ACTFL_LEVELS = [
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
] as const;

export type ActflLevel = (typeof ACTFL_LEVELS)[number];

export function isActflLevel(id: string): id is ActflLevel {
	return (ACTFL_LEVELS as readonly string[]).includes(id);
}

export function actflIndex(level: ActflLevel): number {
	return ACTFL_LEVELS.indexOf(level);
}

export function actflAt(index: number): ActflLevel {
	return ACTFL_LEVELS[Math.min(10, Math.max(0, Math.round(index)))];
}

export const ACTFL_DESCRIPTIONS: Record<ActflLevel, string> = {
	'Novice Low': 'Isolated words and memorized phrases',
	'Novice Mid': 'Everyday words and simple lists',
	'Novice High': 'Simple sentences on familiar topics',
	'Intermediate Low': 'Connected sentences, basic narration',
	'Intermediate Mid': 'Paragraph-length speech on familiar matters',
	'Intermediate High': 'Narrating across time frames, some abstract topics',
	'Advanced Low': 'Fluent interaction, supported argumentation',
	'Advanced Mid': 'Confident discussion of abstract and social topics',
	'Advanced High': 'Precise, organized extended discourse',
	Superior: 'Nuanced debate, cultural references, register control',
	Distinguished: 'Near-native precision, stylistic mastery'
};

/** Map a 0-100 score to an ACTFL sublevel (11 equal bands). */
export function scoreToActfl(score: number): ActflLevel {
	const s = Math.min(100, Math.max(0, score));
	return actflAt(Math.floor((s / 100) * 11));
}

/** [lo, hi) score bounds of a sublevel band, plus its midpoint. */
export function actflBand(level: ActflLevel): { lo: number; hi: number; mid: number } {
	const idx = actflIndex(level);
	const lo = Math.round((idx * 100) / 11);
	const hi = idx === 10 ? 100 : Math.round(((idx + 1) * 100) / 11);
	return { lo, hi, mid: Math.round((lo + hi) / 2) };
}

/** Map continuous 1-10 story difficulty to ACTFL. */
export function storyLevelToActfl(level: number): ActflLevel {
	const s = Math.min(10, Math.max(1, level));
	return actflAt(((s - 1) / 9) * 10);
}

/** Map ACTFL to a starting story difficulty (1-10). */
export function actflToStoryLevel(level: ActflLevel): number {
	return Math.round((actflIndex(level) / 10) * 9 + 1);
}

/** Migrate legacy CEFR levels (stored before the ACTFL switch) forward. */
export function migrateCefrToActfl(cefr: string): ActflLevel {
	switch (cefr) {
		case 'A1':
			return 'Novice Mid';
		case 'A2':
			return 'Intermediate Low';
		case 'B1':
			return 'Intermediate Mid';
		case 'B2':
			return 'Advanced Low';
		case 'C1':
			return 'Advanced Mid';
		case 'C2':
			return 'Superior';
		default:
			return isActflLevel(cefr) ? cefr : 'Novice Low';
	}
}

// ---- Automatic promotion (deliberately difficult) ----------------------------

/**
 * Cumulative KNOWN words (proficiency >= 3) required to *reach* each sublevel
 * from the one below. Steep on purpose: sublevels must feel earned.
 * Index 0 (Novice Low) is the floor and needs nothing.
 */
const WORDS_TO_REACH = [0, 40, 100, 180, 300, 450, 650, 900, 1200, 1600, 2200];

/** Minimum recall rate over recent reviews to qualify for promotion. */
export const PROMOTION_MIN_RECALL = 0.8;
/** Minimum reviewed cards in the window before promotion is considered. */
export const PROMOTION_MIN_REVIEWS = 20;

export function wordsRequiredFor(index: number): number {
	return WORDS_TO_REACH[Math.min(10, Math.max(0, index))] ?? 0;
}

export interface PromotionEligibility {
	eligible: boolean;
	next: ActflLevel | null;
	needWords: number;
	haveWords: number;
	recall: number;
	reviewCount: number;
	/** Human-readable blockers when not eligible. */
	reasons: string[];
}

/**
 * Pure promotion gate: known-word count AND sustained recall, one sublevel at
 * a time. Called after reviews; the AI confirmation step (when a key is set)
 * happens separately in ai/promote.
 */
export function promotionEligibility(
	current: ActflLevel,
	knownWords: number,
	correctReviews: number,
	totalReviews: number
): PromotionEligibility {
	const idx = actflIndex(current);
	const base = {
		haveWords: knownWords,
		recall: totalReviews > 0 ? correctReviews / totalReviews : 0,
		reviewCount: totalReviews,
		reasons: [] as string[]
	};
	if (idx >= 10) {
		return { ...base, eligible: false, next: null, needWords: 0, reasons: ['Top level reached.'] };
	}
	const next = actflAt(idx + 1);
	const needWords = wordsRequiredFor(idx + 1);
	const reasons: string[] = [];
	if (knownWords < needWords) {
		reasons.push(`${needWords - knownWords} more known words needed for ${next}.`);
	}
	if (totalReviews < PROMOTION_MIN_REVIEWS) {
		reasons.push(
			`Need at least ${PROMOTION_MIN_REVIEWS} graded reviews (${totalReviews} so far).`
		);
	} else if (base.recall < PROMOTION_MIN_RECALL) {
		reasons.push(
			`Recall is ${Math.round(base.recall * 100)}% — need ${PROMOTION_MIN_RECALL * 100}% for ${next}.`
		);
	}
	return { ...base, eligible: reasons.length === 0, next, needWords, reasons };
}
