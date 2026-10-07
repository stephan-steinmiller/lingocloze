import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { SvelteURL, SvelteURLSearchParams } from 'svelte/reactivity';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = (): boolean =>
	!!SUPABASE_URL?.trim() && !!SUPABASE_ANON_KEY?.trim();

let client: SupabaseClient | null = null;

/**
 * Where magic-link / OAuth emails send the user back: the dedicated
 * client-only /auth/callback page, which exchanges the PKCE code and forwards
 * to `next`. Works on static hosts (surge.sh) and dev with no server route.
 * Undefined on native shells (capacitor://) and SSR — there the 6-digit OTP
 * code is the way in, since an https redirect can't return in-app.
 * Supabase must allow-list `<origin>/auth/callback` in Redirect URLs.
 */
function callbackUrl(next = '/'): string | undefined {
	if (!browser) return undefined;
	try {
		if (!/^https?:$/.test(window.location.protocol)) return undefined;
		const origin = window.location.origin;
		return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
	} catch {
		return undefined;
	}
}

/** Lazily created browser client (null when env is missing, e.g. tests). */
export function getSupabase(): SupabaseClient | null {
	if (client) return client;
	if (!isSupabaseConfigured()) return null;
	client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
		auth: {
			// Static SPA (adapter-static, no server): sessions live in
			// localStorage. PKCE + detectSessionInUrl lets the client pick up
			// `?code=` after OAuth/magic-link without any server code.
			// (We deliberately do NOT use @supabase/ssr here — that package
			// is for cookie-based SSR apps with a server; this app has none
			// on static hosts.)
			flowType: 'pkce',
			detectSessionInUrl: true,
			persistSession: true,
			autoRefreshToken: true
		}
	});
	return client;
}

/** Test-only: drop the singleton so env changes take effect. */
export function resetSupabaseForTests(): void {
	client = null;
}

// ---- Reactive session state -------------------------------------------------

let user = $state<User | null>(null);
let sessionChecked = $state(false);
let authListenerStarted = false;

export function getUser(): User | null {
	return user;
}

export function isSessionChecked(): boolean {
	return sessionChecked;
}

function applySession(session: Session | null): void {
	user = session?.user ?? null;
	sessionChecked = true;
}

/** Idempotent: call from the layout on startup. */
export async function initAuth(): Promise<void> {
	const sb = getSupabase();
	if (!sb) {
		sessionChecked = true;
		return;
	}
	try {
		// Returning from a magic-link / OAuth redirect (e.g. an old link that
		// landed on /): consume the callback before reading the session.
		// With detectSessionInUrl:true the client also auto-exchanges `?code=`
		// during getSession() on the OAuth return trip; the dedicated
		// /auth/callback page exchanges explicitly too (more reliable on
		// static hosts where the first load may race init).
		try {
			await handleAuthCallback();
		} catch {
			/* bad/expired link — surfaced on /login; ignore elsewhere */
		}
		const { data, error } = await sb.auth.getSession();
		if (error) console.warn('[auth] getSession failed:', error.message);
		applySession(data.session);
	} catch (err) {
		console.warn('[auth] init failed:', err instanceof Error ? err.message : err);
		sessionChecked = true;
	}
	if (!authListenerStarted) {
		authListenerStarted = true;
		sb.auth.onAuthStateChange((event, newSession) => {
			// TOKEN_REFRESHED / SIGNED_IN / SIGNED_OUT all funnel here and
			// keep the layout's per-account stores in sync.
			if (event === 'SIGNED_OUT') {
				user = null;
				sessionChecked = true;
				return;
			}
			applySession(newSession);
		});
	}
}

/**
 * Exchange an OAuth/magic-link `?code=` for a session. Used by the
 * client-only /auth/callback page. Returns the `next` path to continue to.
 */
export async function exchangeCodeForSession(code: string): Promise<string> {
	const sb = getSupabase();
	if (!sb) throw new Error('Supabase is not configured.');
	const { data, error } = await sb.auth.exchangeCodeForSession(code);
	if (error) throw error;
	applySession(data.session);
	try {
		// One-shot read: plain URL is correct here (not reactive SvelteURL).
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new URL(window.location.href).searchParams.get('next');
		return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
	} catch {
		return '/';
	}
}

export function getSession(): Promise<Session | null> {
	const sb = getSupabase();
	if (!sb) return Promise.resolve(null);
	return sb.auth.getSession().then(({ data }) => data.session);
}

export function getAccessToken(): Promise<string | null> {
	return getSession().then((s) => s?.access_token ?? null);
}

export async function sendOtp(email: string): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('Supabase is not configured.');
	const { error } = await sb.auth.signInWithOtp({
		email: email.trim(),
		options: {
			shouldCreateUser: true,
			// Magic-link clicks land on the client callback page, which
			// exchanges the code and forwards to `next`. 6-digit codes typed
			// into /login ignore this and verify via verifyOtp().
			emailRedirectTo: callbackUrl('/') ?? undefined
		}
	});
	if (error) throw error;
}

/**
 * Consume a return visit from a magic-link / OAuth redirect.
 * - PKCE (`?code=…`): exchanged for a session.
 * - Token-hash links (`?token_hash=…&type=…`): verified as an OTP.
 * - Implicit flow (`#access_token=…`): picked up from the URL hash.
 *
 * Returns true when a callback was consumed (throws when the link itself is
 * bad/expired so the UI can show it). One-time params are stripped from the
 * URL afterwards so reloads don't replay them.
 */
export async function handleAuthCallback(): Promise<boolean> {
	const sb = getSupabase();
	if (!sb || typeof window === 'undefined') return false;
	const url = new SvelteURL(window.location.href);
	const code = url.searchParams.get('code');
	const tokenHash = url.searchParams.get('token_hash');
	const typeParam = url.searchParams.get('type');
	const hasImplicitToken = new SvelteURLSearchParams(window.location.hash.replace(/^#/, '')).has(
		'access_token'
	);
	if (!code && !tokenHash && !hasImplicitToken) return false;

	if (code) {
		const { error } = await sb.auth.exchangeCodeForSession(code);
		if (error) throw error;
	} else if (tokenHash) {
		const { error } = await sb.auth.verifyOtp({
			token_hash: tokenHash,
			type: (typeParam || 'email') as
				| 'email'
				| 'magiclink'
				| 'recovery'
				| 'invite'
				| 'email_change'
				| 'signup'
		});
		if (error) throw error;
	} else {
		const { error } = await sb.auth.getSession();
		if (error) throw error;
	}

	url.searchParams.delete('code');
	url.searchParams.delete('token_hash');
	url.searchParams.delete('type');
	window.history.replaceState(
		{},
		'',
		url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '')
	);
	return true;
}

export async function verifyOtp(email: string, code: string): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('Supabase is not configured.');
	const { error } = await sb.auth.verifyOtp({
		email: email.trim(),
		token: code.trim(),
		type: 'email'
	});
	if (error) throw error;
}

export async function signInWithOAuth(
	provider: 'google' | 'github' | 'apple' | 'discord',
	next = '/'
): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('Supabase is not configured.');
	const { error } = await sb.auth.signInWithOAuth({
		provider,
		options: { redirectTo: callbackUrl(next) ?? undefined }
	});
	if (error) throw error;
}

export async function signOut(): Promise<void> {
	const sb = getSupabase();
	if (!sb) return;
	await sb.auth.signOut();
	user = null;
}
