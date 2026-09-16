import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Lazily created browser client (null when env is missing, e.g. tests). */
export function getSupabase(): SupabaseClient | null {
	if (client) return client;
	if (!isSupabaseConfigured()) return null;
	client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
	return client;
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
		options: { shouldCreateUser: true }
	});
	if (error) throw error;
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
		options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined }
	});
	if (error) throw error;
}

export async function signOut(): Promise<void> {
	const sb = getSupabase();
	if (!sb) return;
	await sb.auth.signOut();
	user = null;
}
