<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		exchangeCodeForSession,
		getSupabase,
		isSupabaseConfigured
	} from '$lib/stores/auth.svelte';
	import { touchDb } from '$lib/stores/app.svelte';

	let status = $state<'working' | 'error'>('working');
	let error = $state('');

	function safeNext(raw: string | null): string {
		if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
		return '/';
	}

	onMount(async () => {
		if (!isSupabaseConfigured()) {
			status = 'error';
			error = 'Supabase is not configured in this build.';
			return;
		}
		const url = new URL(window.location.href);
		const code = url.searchParams.get('code');
		const oauthError = url.searchParams.get('error_description') ?? url.searchParams.get('error');
		const next = safeNext(url.searchParams.get('next'));
		if (oauthError) {
			status = 'error';
			error = oauthError;
			return;
		}
		try {
			if (code) {
				const dest = await exchangeCodeForSession(code);
				touchDb();
				// `next` is user-controlled (but same-origin checked): goto
				// takes a plain string, resolve() only accepts typed literals.
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(safeNext(dest) === '/' ? next : safeNext(dest));
				return;
			}
			// No code (e.g. implicit flow or already exchanged by
			// detectSessionInUrl during initAuth): if we have a session,
			// continue; otherwise bounce to login.
			const sb = getSupabase();
			const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
			touchDb();
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(data.session ? next : resolve('/login'));
		} catch (err) {
			status = 'error';
			error = err instanceof Error ? err.message : 'Sign-in failed. Try again.';
		}
	});
</script>

<h1 class="mb-1 text-2xl font-bold">Signing you in…</h1>
{#if status === 'working'}
	<div class="mt-6 flex flex-col items-center gap-3">
		<span class="loading loading-lg loading-spinner text-primary"></span>
		<p class="text-sm opacity-60">Finishing the Supabase handshake.</p>
	</div>
{:else}
	<div role="alert" class="mt-4 alert alert-error">
		<span>{error}</span>
	</div>
	<a href={resolve('/login')} class="btn mt-4 btn-primary">Back to login</a>
{/if}
