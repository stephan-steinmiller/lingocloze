<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		GithubIcon,
		GoogleIcon,
		Login01Icon,
		Logout01Icon,
		Mail01Icon
	} from '@hugeicons/core-free-icons';
	import {
		getUser,
		isSupabaseConfigured,
		sendOtp,
		signInWithOAuth,
		signOut,
		verifyOtp
	} from '$lib/stores/auth.svelte';
	import { touchDb } from '$lib/stores/app.svelte';

	let email = $state('');
	let code = $state('');
	let step = $state<'email' | 'code'>('email');
	let busy = $state(false);
	let error = $state('');
	let user = $derived(getUser());

	async function send(): Promise<void> {
		if (!email.includes('@')) {
			error = 'Enter a valid email address.';
			return;
		}
		error = '';
		busy = true;
		try {
			await sendOtp(email);
			step = 'code';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not send the code.';
		} finally {
			busy = false;
		}
	}

	async function confirm(): Promise<void> {
		if (code.trim().length < 6) {
			error = 'Enter the 6-digit code from the email.';
			return;
		}
		error = '';
		busy = true;
		try {
			await verifyOtp(email, code);
			touchDb();
			await goto(resolve('/'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Code not accepted. Try again.';
		} finally {
			busy = false;
		}
	}

	async function oauth(provider: 'google' | 'github'): Promise<void> {
		error = '';
		busy = true;
		try {
			await signInWithOAuth(provider);
			// Redirects away; the layout picks up the session on return.
		} catch (err) {
			error = err instanceof Error ? err.message : 'OAuth failed.';
			busy = false;
		}
	}

	async function logout(): Promise<void> {
		await signOut();
		touchDb();
	}
</script>

<h1 class="mb-1 flex items-center gap-2 text-2xl font-bold">
	<HugeiconsIcon icon={Login01Icon} size={26} /> Account
</h1>
<p class="mb-6 opacity-70">One account, your own progress on every device you use.</p>

{#if !isSupabaseConfigured()}
	<div role="alert" class="alert alert-warning">
		<span>Supabase isn't configured — auth is disabled in this build.</span>
	</div>
{:else if user}
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<p class="font-semibold">{user.email}</p>
			<p class="text-sm opacity-60">Logged in. Progress is stored under this account.</p>
			<div class="card-actions mt-2">
				<button class="btn btn-outline" onclick={logout}>
					<HugeiconsIcon icon={Logout01Icon} size={18} /> Log out
				</button>
				<a href={resolve('/')} class="btn btn-primary">Continue learning →</a>
			</div>
		</div>
	</div>
{:else if step === 'email'}
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title">
				<HugeiconsIcon icon={Mail01Icon} size={22} /> Email code
			</h2>
			<p class="text-sm opacity-70">No password — we email you a 6-digit code.</p>
			<div class="mt-2 flex gap-2">
				<input
					class="input flex-1"
					type="email"
					placeholder="you@example.com"
					bind:value={email}
					autocomplete="email"
					disabled={busy}
				/>
				<button class="btn btn-primary" disabled={busy || !email} onclick={send}>
					{#if busy}<span class="loading loading-sm loading-spinner"></span>{/if}
					Send code
				</button>
			</div>
			{#if error}<p class="mt-2 text-sm text-error">{error}</p>{/if}
			<div class="divider">or</div>
			<div class="grid gap-2 sm:grid-cols-2">
				<button class="btn btn-outline" disabled={busy} onclick={() => oauth('google')}>
					<HugeiconsIcon icon={GoogleIcon} size={18} /> Google
				</button>
				<button class="btn btn-outline" disabled={busy} onclick={() => oauth('github')}>
					<HugeiconsIcon icon={GithubIcon} size={18} /> GitHub
				</button>
			</div>
			<p class="mt-2 text-xs opacity-60">
				Google/GitHub need enabling in the Supabase dashboard (Auth → Providers).
			</p>
		</div>
	</div>
{:else}
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title">Check {email}</h2>
			<p class="text-sm opacity-70">Enter the 6-digit code (check spam too).</p>
			<div class="mt-2 flex gap-2">
				<input
					class="input flex-1 text-center text-xl tracking-[0.5em]"
					inputmode="numeric"
					maxlength={6}
					placeholder="••••••"
					bind:value={code}
					autocomplete="one-time-code"
					disabled={busy}
				/>
				<button class="btn btn-primary" disabled={busy} onclick={confirm}>
					{#if busy}<span class="loading loading-sm loading-spinner"></span>{/if}
					Verify
				</button>
			</div>
			{#if error}<p class="mt-2 text-sm text-error">{error}</p>{/if}
			<button class="btn btn-ghost btn-sm mt-2 self-start" onclick={() => (step = 'email')}>
				← Use a different email
			</button>
		</div>
	</div>
{/if}
