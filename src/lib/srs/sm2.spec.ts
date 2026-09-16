import { describe, expect, it } from 'vitest';
import { FIVE_MINUTES, ONE_HOUR, formatInterval, gradeToQuality, reviewSrs } from './sm2';

describe('gradeToQuality', () => {
	it('maps grades to SM-2 quality scores (correct-only grades)', () => {
		expect(gradeToQuality('hard')).toBe(3);
		expect(gradeToQuality('fine')).toBe(4);
		expect(gradeToQuality('easy')).toBe(5);
	});
});

describe('reviewSrs', () => {
	const fresh = { easeFactor: 2.5, interval: 0, repetitions: 0 };

	it('keeps new-card intervals short: hard=5min, fine=1h, easy=1d', () => {
		expect(reviewSrs(fresh, 'hard', 0).interval).toBeCloseTo(FIVE_MINUTES, 3);
		expect(reviewSrs(fresh, 'fine', 0).interval).toBeCloseTo(ONE_HOUR, 3);
		expect(reviewSrs(fresh, 'easy', 0).interval).toBe(1);
	});

	it('always advances repetitions (only called on correct recall)', () => {
		const res = reviewSrs(fresh, 'hard', 0);
		expect(res.repetitions).toBe(1);
		expect(res.dueAt).toBeGreaterThan(0);
	});

	it('grows intervals on repeated fine grades', () => {
		const once = reviewSrs(fresh, 'fine', 0);
		const twice = reviewSrs(once, 'fine', 0);
		expect(twice.interval).toBeGreaterThan(once.interval);
	});

	it('never drops ease below 1.3', () => {
		let s = { easeFactor: 1.4, interval: 5, repetitions: 3 };
		for (let i = 0; i < 10; i++) s = reviewSrs(s, 'hard', 0);
		expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
	});

	it('passes lapses through untouched (callers record struggle)', () => {
		const res = reviewSrs(fresh, 'fine', 0, 2);
		expect(res.lapses).toBe(2);
	});
});

describe('formatInterval', () => {
	it('formats minutes, hours and multi-day intervals', () => {
		expect(formatInterval(FIVE_MINUTES)).toBe('5 min');
		expect(formatInterval(ONE_HOUR)).toMatch(/1 h/);
		expect(formatInterval(1)).toBe('1 d');
		expect(formatInterval(60)).toBe('2 mo');
	});
});
