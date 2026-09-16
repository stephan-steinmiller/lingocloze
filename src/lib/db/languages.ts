/** Proficiency scale + story-difficulty mapping live in $lib/actfl. */

export interface SupportedLanguage {
	code: string;
	name: string;
	flag: string;
	/** Hint for AI prompts, e.g. articles/cases to watch for */
	grammarNote: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
	{
		code: 'es',
		name: 'Spanish',
		flag: '🇪🇸',
		grammarNote: 'gendered nouns, ser/estar, subjunctive'
	},
	{ code: 'fr', name: 'French', flag: '🇫🇷', grammarNote: 'gendered nouns, liaison, subjunctive' },
	{
		code: 'de',
		name: 'German',
		flag: '🇩🇪',
		grammarNote: 'three genders, four cases, verb-final subordinate clauses'
	},
	{
		code: 'it',
		name: 'Italian',
		flag: '🇮🇹',
		grammarNote: 'gendered nouns, passato prossimo vs imperfetto'
	},
	{
		code: 'pt',
		name: 'Portuguese',
		flag: '🇵🇹',
		grammarNote: 'gendered nouns, personal infinitive, nasal vowels'
	},
	{
		code: 'nl',
		name: 'Dutch',
		flag: '🇳🇱',
		grammarNote: 'de/het nouns, V2 word order, separable verbs'
	},
	{
		code: 'ja',
		name: 'Japanese',
		flag: '🇯🇵',
		grammarNote: 'particles は/が/を/に, politeness levels, kanji with furigana hints'
	},
	{
		code: 'ko',
		name: 'Korean',
		flag: '🇰🇷',
		grammarNote: 'particles 은/는/이/가, honorifics, SOV order'
	},
	{
		code: 'zh',
		name: 'Chinese (Mandarin)',
		flag: '🇨🇳',
		grammarNote: 'tones, measure words, no conjugation'
	},
	{
		code: 'ru',
		name: 'Russian',
		flag: '🇷🇺',
		grammarNote: 'three genders, six cases, aspect pairs'
	},
	{
		code: 'pl',
		name: 'Polish',
		flag: '🇵🇱',
		grammarNote: 'seven cases, aspect, consonant clusters'
	},
	{
		code: 'tr',
		name: 'Turkish',
		flag: '🇹🇷',
		grammarNote: 'agglutination, vowel harmony, SOV order'
	},
	{
		code: 'ar',
		name: 'Arabic (MSA)',
		flag: '🇸🇦',
		grammarNote: 'root system, gender, VSO tendencies, diacritics for learners'
	},
	{ code: 'el', name: 'Greek', flag: '🇬🇷', grammarNote: 'three genders, cases, aspect' },
	{ code: 'sv', name: 'Swedish', flag: '🇸🇪', grammarNote: 'en/ett nouns, V2, pitch accent' },
	{ code: 'da', name: 'Danish', flag: '🇩🇰', grammarNote: 'en/et nouns, V2, soft d' },
	{
		code: 'fi',
		name: 'Finnish',
		flag: '🇫🇮',
		grammarNote: '15 cases, vowel harmony, no grammatical gender'
	},
	{
		code: 'hu',
		name: 'Hungarian',
		flag: '🇭🇺',
		grammarNote: 'agglutination, vowel harmony, 18 cases, definite/indefinite conjugation'
	},
	{
		code: 'id',
		name: 'Indonesian',
		flag: '🇮🇩',
		grammarNote: 'no conjugation, affixes me-/ber-/di-, reduplication'
	}
];

export const TOPIC_SUGGESTIONS = [
	'Travel & directions',
	'Food & restaurants',
	'Daily routine',
	'Work & office',
	'Family & friends',
	'Shopping',
	'Health & doctor',
	'Weather & seasons',
	'Sports & hobbies',
	'Technology',
	'News & politics',
	'Culture & traditions'
] as const;

/** Clamp story difficulty and round to 1 decimal. */
export function clampStoryLevel(n: number): number {
	return Math.min(10, Math.max(1, Math.round(n * 10) / 10));
}

export function languageName(code: string): string {
	return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
