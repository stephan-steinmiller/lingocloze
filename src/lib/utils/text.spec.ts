import { describe, expect, it } from 'vitest';
import { answersMatch, normalizeAnswer, splitCloze } from './text';

describe('normalizeAnswer', () => {
	it('ignores case, accents and punctuation', () => {
		expect(normalizeAnswer('¿Cómo estás?')).toBe('como estas');
		expect(answersMatch('RAPIDO', 'rápido')).toBe(true);
	});

	it('rejects empty input', () => {
		expect(answersMatch('', 'hola')).toBe(false);
		expect(answersMatch('hola', 'adiós')).toBe(false);
	});
});

describe('splitCloze', () => {
	it('splits on the blank marker', () => {
		expect(splitCloze('Yo ___ agua.')).toEqual(['Yo ', ' agua.']);
		expect(splitCloze('No blank')).toEqual(['No blank', '']);
	});
});
