import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, getTheme, isTheme, setTheme } from './themes';

describe('THEMES', () => {
	it('lists all 35 built-in daisyUI themes without duplicates', () => {
		expect(THEMES).toHaveLength(35);
		expect(new Set(THEMES).size).toBe(35);
		expect(THEMES).toContain('light');
		expect(THEMES).toContain('dark');
		expect(THEMES).toContain('dracula');
		expect(THEMES).toContain('silk');
	});

	it('validates theme ids', () => {
		expect(isTheme('cupcake')).toBe(true);
		expect(isTheme('forest')).toBe(true);
		expect(isTheme('nope')).toBe(false);
		expect(DEFAULT_THEME).toBe('forest');
	});

	it('falls back to default outside the browser', () => {
		expect(getTheme()).toBe('forest');
		expect(setTheme('nope')).toBe('forest');
	});
});
