import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SvelteURL, SvelteURLSearchParams } from 'svelte/reactivity';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Lazily created browser client (null when env is missing, e.g. tests). */
export function getSupabase(): SupabaseClient | null {
	if (client) return client;
	if (!isSupabaseConfigured()) return null;
	client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
		auth: {
			flowType: 'pkce',
			detectSessionInUrl: true,
			persistSession: true,
			autoRefreshToken: true
		}
	});
	return client;
}

/**
 * Where magic-link / OAuth emails should send the user back: the existing
 * prerendered /login page, which knows how to exchange the callback for a
 * session. Undefined on native shells (capacitor://) and SSR — there the
 * 6-digit OTP code is the way in, since an https redirect can't return in-app.
 */
function loginRedirectUrl(): string | undefined {
	try {
		if (typeof window === 'undefined') return undefined;
		if (!/^https?:$/.test(window.location.protocol)) return undefined;
		return `${window.location.origin}/login`;
	} catch {
		return undefined;
	}
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
		try {
			await handleAuthCallback();
		} catch {
			/* bad/expired link — surfaced on /login; ignore elsewhere */
		}
		const { data } = await sb.auth.getSession();
		applySession(data.session);
	} catch {
		sessionChecked = true;
	}
	if (!authListenerStarted) {
		authListenerStarted = true;
		sb.auth.onAuthStateChange((_event, newSession) => {
			applySession(newSession);
		});
	}
}

export async function sendOtp(email: string): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('Supabase is not configured.');
	const { error } = await sb.auth.signInWithOtp({
		email: email.trim(),
		options: { shouldCreateUser: true, emailRedirectTo: loginRedirectUrl() }
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
				'email' | 'magiclink' | 'recovery' | 'invite' | 'email_change' | 'signup'
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
	provider: 'google' | 'github' | 'apple' | 'discord'
): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('Supabase is not configured.');
	const { error } = await sb.auth.signInWithOAuth({
		provider,
		options: {
			redirectTo:
				loginRedirectUrl() ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
		}
	});
	if (error) throw error;
}

export async function signOut(): Promise<void> {
	const sb = getSupabase();
	if (!sb) return;
	await sb.auth.signOut();
	user = null;
}
