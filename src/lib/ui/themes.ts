// All 35 built-in DaisyUI v5 themes (see https://daisyui.com/docs/themes/).
// Enabled via `themes: all` in src/routes/layout.css.
export const THEMES = [
	'light',
	'dark',
	'cupcake',
	'bumblebee',
	'emerald',
	'corporate',
	'synthwave',
	'retro',
	'cyberpunk',
	'valentine',
	'halloween',
	'garden',
	'forest',
	'aqua',
	'lofi',
	'pastel',
	'fantasy',
	'wireframe',
	'black',
	'luxury',
	'dracula',
	'cmyk',
	'autumn',
	'business',
	'acid',
	'lemonade',
	'night',
	'coffee',
	'winter',
	'dim',
	'nord',
	'sunset',
	'caramellatte',
	'abyss',
	'silk'
] as const;

export type ThemeId = (typeof THEMES)[number];

const THEME_KEY = 'ling_theme_v1';
export const DEFAULT_THEME: ThemeId = 'forest';

export function isTheme(id: string): id is ThemeId {
	return (THEMES as readonly string[]).includes(id);
}

/** Read the saved theme (safe on server — falls back to default). */
export function getTheme(): ThemeId {
	try {
		if (typeof localStorage === 'undefined') return DEFAULT_THEME;
		const saved = localStorage.getItem(THEME_KEY);
		if (saved && isTheme(saved)) return saved;
	} catch {
		/* ignore */
	}
	return DEFAULT_THEME;
}

/** Apply + persist a theme. Unknown ids fall back to default. */
export function setTheme(id: string): ThemeId {
	const theme = isTheme(id) ? id : DEFAULT_THEME;
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {
		/* private mode etc. */
	}
	try {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', theme);
		}
	} catch {
		/* ignore */
	}
	return theme;
}
