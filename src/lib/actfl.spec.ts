import { describe, expect, it } from 'vitest';
import {
	ACTFL_LEVELS,
	actflAt,
	actflIndex,
	actflToStoryLevel,
	migrateCefrToActfl,
	promotionEligibility,
	scoreToActfl,
	storyLevelToActfl,
	wordsRequiredFor
} from './actfl';

describe('scale', () => {
	it('has 11 sublevels in order', () => {
		expect(ACTFL_LEVELS).toHaveLength(11);
		expect(ACTFL_LEVELS[0]).toBe('Novice Low');
		expect(ACTFL_LEVELS[10]).toBe('Distinguished');
		expect(actflIndex('Intermediate Mid')).toBe(4);
		expect(actflAt(99)).toBe('Distinguished');
		expect(actflAt(-3)).toBe('Novice Low');
	});

	it('maps scores to bands linearly', () => {
		expect(scoreToActfl(0)).toBe('Novice Low');
		expect(scoreToActfl(100)).toBe('Distinguished');
		expect(scoreToActfl(50)).toBe('Intermediate High');
		expect(scoreToActfl(9)).toBe('Novice Low');
		expect(scoreToActfl(10)).toBe('Novice Mid');
	});

	it('round-trips story difficulty', () => {
		expect(storyLevelToActfl(1)).toBe('Novice Low');
		expect(storyLevelToActfl(10)).toBe('Distinguished');
		expect(actflToStoryLevel('Novice Low')).toBe(1);
		expect(actflToStoryLevel('Distinguished')).toBe(10);
		expect(actflToStoryLevel(storyLevelToActfl(6))).toBe(6);
	});
});

describe('migrateCefrToActfl', () => {
	it('maps legacy CEFR levels forward and passes ACTFL through', () => {
		expect(migrateCefrToActfl('A1')).toBe('Novice Mid');
		expect(migrateCefrToActfl('B1')).toBe('Intermediate Mid');
		expect(migrateCefrToActfl('C2')).toBe('Superior');
		expect(migrateCefrToActfl('Advanced Low')).toBe('Advanced Low');
		expect(migrateCefrToActfl('???')).toBe('Novice Low');
	});
});

describe('promotionEligibility', () => {
	it('is deliberately hard: needs words AND recall AND volume', () => {
		const fresh = promotionEligibility('Novice Low', 0, 0, 0);
		expect(fresh.eligible).toBe(false);
		expect(fresh.next).toBe('Novice Mid');
		expect(fresh.reasons.length).toBeGreaterThan(0);

		const wordsOnly = promotionEligibility('Novice Low', 500, 5, 5);
		expect(wordsOnly.eligible).toBe(false); // too few reviews

		const sloppy = promotionEligibility('Novice Low', 500, 10, 20);
		expect(sloppy.eligible).toBe(false); // 50% recall

		const earned = promotionEligibility('Novice Low', 40, 18, 20);
		expect(earned.eligible).toBe(true);
		expect(earned.next).toBe('Novice Mid');
	});

	it('caps at Distinguished and climbs one step at a time', () => {
		const top = promotionEligibility('Distinguished', 99999, 100, 100);
		expect(top.eligible).toBe(false);
		expect(top.next).toBeNull();
		const high = promotionEligibility('Superior', 2200, 20, 20);
		expect(high.eligible).toBe(true);
		expect(high.next).toBe('Distinguished');
	});

	it('raises the word bar steeply per sublevel', () => {
		const needs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(wordsRequiredFor);
		for (let i = 1; i < needs.length; i++) expect(needs[i]).toBeGreaterThan(needs[i - 1]);
		expect(wordsRequiredFor(10)).toBeGreaterThanOrEqual(2000);
	});
});
