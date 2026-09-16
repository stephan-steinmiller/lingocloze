import type { ActflLevel } from '$lib/actfl';
import { scoreToActfl } from '$lib/actfl';
import type { VocabWordAI } from './schemas';

// Curated frequency-tiered vocab for onboarding when no API key is set.
// tier 1 = most common … tier 4 = rarer. 6 words per tier.
const SEEDS: Record<string, VocabWordAI[]> = {
	es: [
		{ text: 'hola', translation: 'hello', pos: 'interj', tier: 1 },
		{ text: 'gracias', translation: 'thank you', pos: 'interj', tier: 1 },
		{ text: 'agua', translation: 'water', pos: 'noun', tier: 1 },
		{ text: 'comer', translation: 'to eat', pos: 'verb', tier: 1 },
		{ text: 'casa', translation: 'house', pos: 'noun', tier: 1 },
		{ text: 'bueno', translation: 'good', pos: 'adj', tier: 1 },
		{ text: 'tiempo', translation: 'time; weather', pos: 'noun', tier: 2 },
		{ text: 'trabajar', translation: 'to work', pos: 'verb', tier: 2 },
		{ text: 'siempre', translation: 'always', pos: 'adv', tier: 2 },
		{ text: 'amigo', translation: 'friend', pos: 'noun', tier: 2 },
		{ text: 'rápido', translation: 'fast', pos: 'adj', tier: 2 },
		{ text: 'preguntar', translation: 'to ask', pos: 'verb', tier: 2 },
		{ text: 'ventana', translation: 'window', pos: 'noun', tier: 3 },
		{ text: 'olvidar', translation: 'to forget', pos: 'verb', tier: 3 },
		{ text: 'alegría', translation: 'joy', pos: 'noun', tier: 3 },
		{ text: 'lento', translation: 'slow', pos: 'adj', tier: 3 },
		{ text: 'a menudo', translation: 'often', pos: 'adv', tier: 3 },
		{ text: 'elegir', translation: 'to choose', pos: 'verb', tier: 3 },
		{ text: 'susurrar', translation: 'to whisper', pos: 'verb', tier: 4 },
		{ text: 'atardecer', translation: 'sunset', pos: 'noun', tier: 4 },
		{ text: 'perspicaz', translation: 'perceptive', pos: 'adj', tier: 4 },
		{ text: 'titubear', translation: 'to hesitate', pos: 'verb', tier: 4 },
		{ text: 'espejismo', translation: 'mirage', pos: 'noun', tier: 4 },
		{ text: 'entretanto', translation: 'meanwhile', pos: 'adv', tier: 4 }
	],
	fr: [
		{ text: 'bonjour', translation: 'hello', pos: 'interj', tier: 1 },
		{ text: 'merci', translation: 'thank you', pos: 'interj', tier: 1 },
		{ text: 'eau', translation: 'water', pos: 'noun', tier: 1 },
		{ text: 'manger', translation: 'to eat', pos: 'verb', tier: 1 },
		{ text: 'maison', translation: 'house', pos: 'noun', tier: 1 },
		{ text: 'bon', translation: 'good', pos: 'adj', tier: 1 },
		{ text: 'temps', translation: 'time; weather', pos: 'noun', tier: 2 },
		{ text: 'travailler', translation: 'to work', pos: 'verb', tier: 2 },
		{ text: 'toujours', translation: 'always', pos: 'adv', tier: 2 },
		{ text: 'ami', translation: 'friend', pos: 'noun', tier: 2 },
		{ text: 'rapide', translation: 'fast', pos: 'adj', tier: 2 },
		{ text: 'demander', translation: 'to ask', pos: 'verb', tier: 2 },
		{ text: 'fenêtre', translation: 'window', pos: 'noun', tier: 3 },
		{ text: 'oublier', translation: 'to forget', pos: 'verb', tier: 3 },
		{ text: 'joie', translation: 'joy', pos: 'noun', tier: 3 },
		{ text: 'lent', translation: 'slow', pos: 'adj', tier: 3 },
		{ text: 'souvent', translation: 'often', pos: 'adv', tier: 3 },
		{ text: 'choisir', translation: 'to choose', pos: 'verb', tier: 3 },
		{ text: 'chuchoter', translation: 'to whisper', pos: 'verb', tier: 4 },
		{ text: 'crépuscule', translation: 'twilight', pos: 'noun', tier: 4 },
		{ text: 'perspicace', translation: 'perceptive', pos: 'adj', tier: 4 },
		{ text: 'hésiter', translation: 'to hesitate', pos: 'verb', tier: 4 },
		{ text: 'mirage', translation: 'mirage', pos: 'noun', tier: 4 },
		{ text: 'cependant', translation: 'however', pos: 'adv', tier: 4 }
	],
	de: [
		{ text: 'hallo', translation: 'hello', pos: 'interj', tier: 1 },
		{ text: 'danke', translation: 'thank you', pos: 'interj', tier: 1 },
		{ text: 'Wasser', translation: 'water', pos: 'noun', tier: 1 },
		{ text: 'essen', translation: 'to eat', pos: 'verb', tier: 1 },
		{ text: 'Haus', translation: 'house', pos: 'noun', tier: 1 },
		{ text: 'gut', translation: 'good', pos: 'adj', tier: 1 },
		{ text: 'Zeit', translation: 'time', pos: 'noun', tier: 2 },
		{ text: 'arbeiten', translation: 'to work', pos: 'verb', tier: 2 },
		{ text: 'immer', translation: 'always', pos: 'adv', tier: 2 },
		{ text: 'Freund', translation: 'friend', pos: 'noun', tier: 2 },
		{ text: 'schnell', translation: 'fast', pos: 'adj', tier: 2 },
		{ text: 'fragen', translation: 'to ask', pos: 'verb', tier: 2 },
		{ text: 'Fenster', translation: 'window', pos: 'noun', tier: 3 },
		{ text: 'vergessen', translation: 'to forget', pos: 'verb', tier: 3 },
		{ text: 'Freude', translation: 'joy', pos: 'noun', tier: 3 },
		{ text: 'langsam', translation: 'slow', pos: 'adj', tier: 3 },
		{ text: 'oft', translation: 'often', pos: 'adv', tier: 3 },
		{ text: 'wählen', translation: 'to choose', pos: 'verb', tier: 3 },
		{ text: 'flüstern', translation: 'to whisper', pos: 'verb', tier: 4 },
		{ text: 'Sonnenuntergang', translation: 'sunset', pos: 'noun', tier: 4 },
		{ text: 'scharfsinnig', translation: 'perceptive', pos: 'adj', tier: 4 },
		{ text: 'zögern', translation: 'to hesitate', pos: 'verb', tier: 4 },
		{ text: 'Fata Morgana', translation: 'mirage', pos: 'noun', tier: 4 },
		{ text: 'inzwischen', translation: 'meanwhile', pos: 'adv', tier: 4 }
	],
	it: [
		{ text: 'ciao', translation: 'hello', pos: 'interj', tier: 1 },
		{ text: 'grazie', translation: 'thank you', pos: 'interj', tier: 1 },
		{ text: 'acqua', translation: 'water', pos: 'noun', tier: 1 },
		{ text: 'mangiare', translation: 'to eat', pos: 'verb', tier: 1 },
		{ text: 'casa', translation: 'house', pos: 'noun', tier: 1 },
		{ text: 'buono', translation: 'good', pos: 'adj', tier: 1 },
		{ text: 'tempo', translation: 'time; weather', pos: 'noun', tier: 2 },
		{ text: 'lavorare', translation: 'to work', pos: 'verb', tier: 2 },
		{ text: 'sempre', translation: 'always', pos: 'adv', tier: 2 },
		{ text: 'amico', translation: 'friend', pos: 'noun', tier: 2 },
		{ text: 'veloce', translation: 'fast', pos: 'adj', tier: 2 },
		{ text: 'chiedere', translation: 'to ask', pos: 'verb', tier: 2 },
		{ text: 'finestra', translation: 'window', pos: 'noun', tier: 3 },
		{ text: 'dimenticare', translation: 'to forget', pos: 'verb', tier: 3 },
		{ text: 'gioia', translation: 'joy', pos: 'noun', tier: 3 },
		{ text: 'lento', translation: 'slow', pos: 'adj', tier: 3 },
		{ text: 'spesso', translation: 'often', pos: 'adv', tier: 3 },
		{ text: 'scegliere', translation: 'to choose', pos: 'verb', tier: 3 },
		{ text: 'sussurrare', translation: 'to whisper', pos: 'verb', tier: 4 },
		{ text: 'tramonto', translation: 'sunset', pos: 'noun', tier: 4 },
		{ text: 'perspicace', translation: 'perceptive', pos: 'adj', tier: 4 },
		{ text: 'esitare', translation: 'to hesitate', pos: 'verb', tier: 4 },
		{ text: 'miraggio', translation: 'mirage', pos: 'noun', tier: 4 },
		{ text: 'frattanto', translation: 'meanwhile', pos: 'adv', tier: 4 }
	],
	pt: [
		{ text: 'olá', translation: 'hello', pos: 'interj', tier: 1 },
		{ text: 'obrigado', translation: 'thank you', pos: 'interj', tier: 1 },
		{ text: 'água', translation: 'water', pos: 'noun', tier: 1 },
		{ text: 'comer', translation: 'to eat', pos: 'verb', tier: 1 },
		{ text: 'casa', translation: 'house', pos: 'noun', tier: 1 },
		{ text: 'bom', translation: 'good', pos: 'adj', tier: 1 },
		{ text: 'tempo', translation: 'time; weather', pos: 'noun', tier: 2 },
		{ text: 'trabalhar', translation: 'to work', pos: 'verb', tier: 2 },
		{ text: 'sempre', translation: 'always', pos: 'adv', tier: 2 },
		{ text: 'amigo', translation: 'friend', pos: 'noun', tier: 2 },
		{ text: 'rápido', translation: 'fast', pos: 'adj', tier: 2 },
		{ text: 'perguntar', translation: 'to ask', pos: 'verb', tier: 2 },
		{ text: 'janela', translation: 'window', pos: 'noun', tier: 3 },
		{ text: 'esquecer', translation: 'to forget', pos: 'verb', tier: 3 },
		{ text: 'alegria', translation: 'joy', pos: 'noun', tier: 3 },
		{ text: 'lento', translation: 'slow', pos: 'adj', tier: 3 },
		{ text: 'frequentemente', translation: 'often', pos: 'adv', tier: 3 },
		{ text: 'escolher', translation: 'to choose', pos: 'verb', tier: 3 },
		{ text: 'sussurrar', translation: 'to whisper', pos: 'verb', tier: 4 },
		{ text: 'pôr do sol', translation: 'sunset', pos: 'noun', tier: 4 },
		{ text: 'perspicaz', translation: 'perceptive', pos: 'adj', tier: 4 },
		{ text: 'hesitar', translation: 'to hesitate', pos: 'verb', tier: 4 },
		{ text: 'miragem', translation: 'mirage', pos: 'noun', tier: 4 },
		{ text: 'entretanto', translation: 'meanwhile', pos: 'adv', tier: 4 }
	],
	hu: [
		{ text: 'szia', translation: 'hello; hi', pos: 'interj', tier: 1 },
		{ text: 'köszönöm', translation: 'thank you', pos: 'interj', tier: 1 },
		{ text: 'víz', translation: 'water', pos: 'noun', tier: 1 },
		{ text: 'enni', translation: 'to eat', pos: 'verb', tier: 1 },
		{ text: 'ház', translation: 'house', pos: 'noun', tier: 1 },
		{ text: 'jó', translation: 'good', pos: 'adj', tier: 1 },
		{ text: 'idő', translation: 'time; weather', pos: 'noun', tier: 2 },
		{ text: 'dolgozni', translation: 'to work', pos: 'verb', tier: 2 },
		{ text: 'mindig', translation: 'always', pos: 'adv', tier: 2 },
		{ text: 'barát', translation: 'friend', pos: 'noun', tier: 2 },
		{ text: 'gyors', translation: 'fast', pos: 'adj', tier: 2 },
		{ text: 'kérdezni', translation: 'to ask', pos: 'verb', tier: 2 },
		{ text: 'ablak', translation: 'window', pos: 'noun', tier: 3 },
		{ text: 'elfelejteni', translation: 'to forget', pos: 'verb', tier: 3 },
		{ text: 'öröm', translation: 'joy', pos: 'noun', tier: 3 },
		{ text: 'lassú', translation: 'slow', pos: 'adj', tier: 3 },
		{ text: 'gyakran', translation: 'often', pos: 'adv', tier: 3 },
		{ text: 'választani', translation: 'to choose', pos: 'verb', tier: 3 },
		{ text: 'suttogni', translation: 'to whisper', pos: 'verb', tier: 4 },
		{ text: 'naplemente', translation: 'sunset', pos: 'noun', tier: 4 },
		{ text: 'éleslátó', translation: 'perceptive', pos: 'adj', tier: 4 },
		{ text: 'habozni', translation: 'to hesitate', pos: 'verb', tier: 4 },
		{ text: 'délibáb', translation: 'mirage', pos: 'noun', tier: 4 },
		{ text: 'időközben', translation: 'meanwhile', pos: 'adv', tier: 4 }
	]
};

export function hasSeedVocab(code: string): boolean {
	return code in SEEDS;
}

/** Offline fallback vocab checklist (seeded languages only). */
export function seedVocab(code: string, count = 24): VocabWordAI[] {
	const list = SEEDS[code] ?? [];
	return list.slice(0, Math.min(count, list.length));
}

// ---- Proficiency heuristic --------------------------------------------------

export interface TierStat {
	tier: number;
	known: number;
	total: number;
}

export interface ProficiencyResult {
	level: ActflLevel;
	score: number;
	rationale: string;
}

/**
 * Map vocab-check results to an ACTFL sublevel. Tier weights reflect frequency:
 * knowing tier-1 words matters more than tier-4. Score is 0-100 across the
 * 11 sublevels so the UI can show smooth progress.
 */
export function assessProficiency(
	checklist: VocabWordAI[],
	knownTexts: Set<string>
): ProficiencyResult {
	const byTier = new Map<number, { known: number; total: number }>();
	for (const w of checklist) {
		const e = byTier.get(w.tier) ?? { known: 0, total: 0 };
		e.total += 1;
		if (knownTexts.has(w.text)) e.known += 1;
		byTier.set(w.tier, e);
	}
	const weights = [0, 0.4, 0.3, 0.2, 0.1]; // index by tier
	let weighted = 0;
	for (const [tier, s] of byTier) {
		if (s.total === 0) continue;
		weighted += (s.known / s.total) * (weights[tier] ?? 0.1);
	}
	// weighted is 0..1 → score 0..100 → ACTFL sublevel (11 bands)
	const score = Math.round(weighted * 100);
	const level = scoreToActfl(score);

	const total = checklist.length;
	const known = knownTexts.size;
	return {
		level,
		score,
		rationale: `You marked ${known} of ${total} words as known. Tier-weighted coverage puts you at ${level} (${score}/100).`
	};
}

// ---- Story difficulty adaptation --------------------------------------------

/**
 * Adjust story difficulty 1-10 after an attempt:
 * - "I did not understand" → −1.5
 * - perfect → +0.7, good (≥70%) → +0.3, weak → −0.7, zero → −1.2
 */
export function adjustStoryLevel(
	current: number,
	score: number,
	total: number,
	understood: boolean
): number {
	let next = current;
	if (!understood) {
		next = current - 1.5;
	} else if (total <= 0) {
		next = current;
	} else {
		const ratio = score / total;
		if (ratio >= 1) next = current + 0.7;
		else if (ratio >= 0.7) next = current + 0.3;
		else if (ratio >= 0.4) next = current - 0.3;
		else if (ratio > 0) next = current - 0.7;
		else next = current - 1.2;
	}
	return Math.min(10, Math.max(1, Math.round(next * 10) / 10));
}
