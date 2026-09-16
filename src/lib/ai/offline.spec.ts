import { describe, expect, it } from 'vitest';
import { adjustStoryLevel, assessProficiency, seedVocab } from './offline';

const checklist = seedVocab('es', 24);

describe('assessProficiency', () => {
	it('places a beginner at Novice Low', () => {
		const res = assessProficiency(checklist, new Set());
		expect(res.level).toBe('Novice Low');
		expect(res.score).toBe(0);
	});

	it('places full knowledge at Distinguished', () => {
		const res = assessProficiency(checklist, new Set(checklist.map((w) => w.text)));
		expect(res.level).toBe('Distinguished');
		expect(res.score).toBeGreaterThan(90);
	});

	it('weights common tiers more than rare ones', () => {
		const tier1 = new Set(checklist.filter((w) => w.tier === 1).map((w) => w.text));
		const tier4 = new Set(checklist.filter((w) => w.tier === 4).map((w) => w.text));
		const a = assessProficiency(checklist, tier1);
		const b = assessProficiency(checklist, tier4);
		expect(a.score).toBeGreaterThan(b.score);
	});
});

describe('adjustStoryLevel', () => {
	it('lowers difficulty when the user did not understand', () => {
		expect(adjustStoryLevel(5, 0, 3, false)).toBeLessThan(5);
	});

	it('raises difficulty on a perfect score', () => {
		expect(adjustStoryLevel(5, 3, 3, true)).toBeGreaterThan(5);
	});

	it('clamps to 1..10', () => {
		expect(adjustStoryLevel(1, 0, 3, false)).toBe(1);
		expect(adjustStoryLevel(10, 3, 3, true)).toBe(10);
	});
});
