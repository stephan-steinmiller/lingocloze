import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLanguage, dbKeyFor, getLanguageByCode, getLanguages } from './database';

function mockLocalStorage(initial: Record<string, string> = {}): void {
	const store = new Map(Object.entries(initial));
	const api = {
		getItem: (k: string): string | null => store.get(k) ?? null,
		setItem: (k: string, v: string): void => {
			store.set(k, v);
		},
		removeItem: (k: string): void => {
			store.delete(k);
		},
		clear: (): void => {
			store.clear();
		}
	};
	vi.stubGlobal('localStorage', api);
}

describe('dbKeyFor', () => {
	it('uses the legacy device key when logged out', () => {
		expect(dbKeyFor(null)).toBe('ling_db_v1');
	});

	it('namespaces the store per account id', () => {
		const a = dbKeyFor('user-1');
		const b = dbKeyFor('user-2');
		expect(a).toContain('user-1');
		expect(a).not.toBe(b);
		expect(a).not.toBe('ling_db_v1');
	});
});

describe('createLanguage (multitenant ids)', () => {
	beforeEach(() => {
		mockLocalStorage();
		vi.unstubAllGlobals?.();
		mockLocalStorage();
	});

	it('generates a globally-unique id, never the bare code', () => {
		const lang = createLanguage({
			code: 'es',
			name: 'Spanish',
			level: 'Novice Mid',
			levelScore: 30
		});
		expect(lang.code).toBe('es');
		expect(lang.id).not.toBe('es');
		expect(lang.id).toMatch(/^lang_/);
		expect(getLanguageByCode('es')?.id).toBe(lang.id);
	});

	it('reuses the existing row for the same code (one entry per code)', () => {
		const a = createLanguage({ code: 'fr', name: 'French', level: 'Novice Mid', levelScore: 10 });
		const b = createLanguage({ code: 'fr', name: 'French', level: 'Novice Mid', levelScore: 10 });
		expect(b.id).toBe(a.id);
		expect(getLanguages().filter((l) => l.code === 'fr')).toHaveLength(1);
	});

	it('migrates legacy id===code rows to unique ids with child refs', async () => {
		const legacyDb = {
			version: 1,
			languages: [
				{
					id: 'es',
					code: 'es',
					name: 'Spanish',
					level: 'Novice Mid',
					levelScore: 30,
					storyLevel: 4,
					knownWordCount: 0,
					createdAt: 1,
					updatedAt: 1
				}
			],
			words: [],
			decks: [],
			cards: [],
			reviewLogs: [],
			stories: [],
			questions: [],
			attempts: []
		};
		mockLocalStorage({ ling_db_v1: JSON.stringify(legacyDb) });
		// Trigger load() via a getter: legacy "es" must be remapped.
		const langs = getLanguages();
		expect(langs).toHaveLength(1);
		expect(langs[0].code).toBe('es');
		expect(langs[0].id).not.toBe('es');
	});
});
