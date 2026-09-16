import { loadSettings, saveSettings, type BYOKSettings } from '$lib/ai/providers';
import { getUser } from './auth.svelte';

const ACTIVE_KEY = 'ling_active_lang_v1';

function activeKey(): string {
	try {
		const uid = getUser()?.id;
		return uid ? `${ACTIVE_KEY}_u_${uid}` : ACTIVE_KEY;
	} catch {
		return ACTIVE_KEY;
	}
}

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
	typeof localStorage !== 'undefined' ? localStorage.getItem(activeKey()) : null;

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
		if (id) localStorage.setItem(activeKey(), id);
		else localStorage.removeItem(activeKey());
	} catch {
		/* ignore */
	}
}

/** Re-read the active language (call after login/logout switches stores). */
export function refreshActiveLanguage(): void {
	try {
		activeLanguageId =
			typeof localStorage !== 'undefined' ? localStorage.getItem(activeKey()) : null;
	} catch {
		activeLanguageId = null;
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
