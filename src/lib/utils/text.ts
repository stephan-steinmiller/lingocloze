/** Lowercase, trim, strip diacritics + punctuation for forgiving answer checks. */
export function normalizeAnswer(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[¿?¡!.,;:'"«»„“”()]/g, '')
		.replace(/\s+/g, ' ');
}

/** True when the typed answer matches (accent/case/punctuation-insensitive). */
export function answersMatch(typed: string, expected: string): boolean {
	if (!typed.trim() || !expected.trim()) return false;
	return normalizeAnswer(typed) === normalizeAnswer(expected);
}

/** Split a cloze sentence on the ___ blank into [before, after]. */
export function splitCloze(sentence: string): [string, string] {
	const idx = sentence.indexOf('___');
	if (idx === -1) return [sentence, ''];
	return [sentence.slice(0, idx), sentence.slice(idx + 3)];
}
