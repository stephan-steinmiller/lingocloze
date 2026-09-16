import type { ReviewGrade } from '$lib/db/types';

export interface SrsState {
	easeFactor: number;
	interval: number; // days
	repetitions: number; // consecutive successful recalls
}

export interface SrsResult extends SrsState {
	dueAt: number;
	lapses: number;
}

export const FIVE_MINUTES = 5 / 1440; // days
export const ONE_HOUR = 1 / 24; // days

/**
 * Gentle SM-2 variant. Grades are only given after a correct recall
 * (misses are retried in-session instead of being graded), so every grade
 * here means "got it right" — hard/fine/easy only tune the next interval.
 * Grades map to SM-2 quality: hard=3, fine=4, easy=5.
 * New cards: hard=5min, fine=1h, easy=1d. Intervals stay short on purpose.
 */
export function gradeToQuality(grade: ReviewGrade): number {
	switch (grade) {
		case 'hard':
			return 3;
		case 'fine':
			return 4;
		case 'easy':
			return 5;
	}
}

export function reviewSrs(
	state: SrsState,
	grade: ReviewGrade,
	now = Date.now(),
	prevLapses = 0
): SrsResult {
	const quality = gradeToQuality(grade);
	let { easeFactor, interval, repetitions } = state;

	// Update ease factor: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
	easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
	if (easeFactor < 1.3) easeFactor = 1.3;

	let nextInterval: number;
	if (repetitions === 0) {
		nextInterval = grade === 'hard' ? FIVE_MINUTES : grade === 'fine' ? ONE_HOUR : 1;
	} else if (repetitions === 1) {
		nextInterval = grade === 'hard' ? ONE_HOUR : grade === 'fine' ? 1 : 3;
	} else {
		nextInterval = interval * easeFactor;
		if (grade === 'hard') nextInterval = Math.max(interval * 1.2, ONE_HOUR);
		if (grade === 'easy') nextInterval = interval * easeFactor * 1.3;
	}
	repetitions += 1;

	// Cap at ~1 year to keep dates sane
	nextInterval = Math.min(nextInterval, 365);

	return {
		easeFactor: Math.round(easeFactor * 100) / 100,
		interval: Math.round(nextInterval * 10000) / 10000,
		repetitions,
		dueAt: now + Math.round(nextInterval * 24 * 60 * 60 * 1000),
		lapses: prevLapses
	};
}

/** Human label for an interval in days. */
export function formatInterval(days: number): string {
	if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))} min`;
	if (days < 1) return `${Math.round(days * 24)} h`;
	if (days < 30) return `${Math.round(days)} d`;
	if (days < 365) return `${Math.round(days / 30)} mo`;
	return `${Math.round((days / 365) * 10) / 10} y`;
}
