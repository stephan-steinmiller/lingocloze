import { loadSettings, saveSettings, type BYOKSettings } from '$lib/ai/providers';

const ACTIVE_KEY = 'ling_active_lang_v1';

// Settings are a plain module-level reactive state (Svelte 5 runes).
let settingsState: BYOKSettings = loadSettings();

export const settingsStore = {
	get value(): BYOKSettings {
		return settingsState;
	},
	update(patch: Partial<BYOKSettings>): void {
		settingsState = { ...settingsState, ...patch };
		saveSettings(settingsState);
	},
	reload(): void {
		settingsState = loadSettings();
	}
};

let activeLanguageId: string | null =
	typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null;

/** Bump after every DB mutation so pages re-read from the store. */
let dbRevision = $state(0);

export function touchDb(): void {
	dbRevision += 1;
}

export function getDbRevision(): number {
	return dbRevision;
}

export function getActiveLanguageId(): string | null {
	return activeLanguageId;
}

export function setActiveLanguageId(id: string | null): void {
	activeLanguageId = id;
	try {
		if (id) localStorage.setItem(ACTIVE_KEY, id);
		else localStorage.removeItem(ACTIVE_KEY);
	} catch {
		/* ignore */
	}
}

const SIDEBAR_KEY = 'ling_sidebar_v1';

/** Collapsed = icons only (desktop). Reactive so the layout re-renders. */
let sidebarCollapsed = $state(
	typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
);

export function isSidebarCollapsed(): boolean {
	return sidebarCollapsed;
}

export function toggleSidebar(): void {
	sidebarCollapsed = !sidebarCollapsed;
	try {
		localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? 'collapsed' : 'open');
	} catch {
		/* ignore */
	}
}
