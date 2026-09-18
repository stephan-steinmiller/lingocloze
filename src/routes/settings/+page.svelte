<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { FloppyDiskIcon, Key01Icon, ViewIcon, ViewOffIcon, CheckmarkCircle02Icon, UserCircleIcon, Logout01Icon } from '@hugeicons/core-free-icons';
	import ThemeSelect from '$lib/components/ThemeSelect.svelte';
	import { getUser, signOut } from '$lib/stores/auth.svelte';
	import { touchDb } from '$lib/stores/app.svelte';
	import {
		PROVIDERS,
		hasApiKey,
		loadSettings,
		saveSettings,
		type AIProvider
	} from '$lib/ai/providers';
	import { exportDatabase, importDatabase, resetDatabase } from '$lib/db/database';

	let settings = $state(loadSettings());
	let showKey = $state(false);
	let savedTick = $state(false);
	let ioError = $state('');
	let user = $derived(getUser());

	async function logout(): Promise<void> {
		await signOut();
		touchDb();
	}

	function save(): void {
		saveSettings(settings);
		savedTick = true;
		setTimeout(() => (savedTick = false), 1500);
	}

	function pickProvider(id: AIProvider): void {
		const meta = PROVIDERS.find((p) => p.id === id);
		settings = {
			...settings,
			provider: id,
			model: meta?.defaultModel ?? settings.model
		};
		save();
	}

	function downloadBackup(): void {
		const blob = new Blob([exportDatabase()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ling-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function restoreBackup(e: Event): Promise<void> {
		ioError = '';
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			importDatabase(await file.text());
			touchDb();
		} catch (err) {
			ioError = err instanceof Error ? err.message : 'Import failed.';
		}
	}

	function wipe(): void {
		if (!confirm('Delete ALL local data (languages, decks, words, stories)?')) return;
		resetDatabase();
		touchDb();
	}
</script>

<h1 class="mb-1 text-2xl font-bold">Settings</h1>
<p class="mb-6 opacity-70">Bring your own key. Everything runs local-first.</p>

<div class="card mb-4 bg-base-100 shadow-sm">
	<div class="card-body flex-row items-center gap-3 px-4 py-3">
		<HugeiconsIcon icon={UserCircleIcon} size={26} />
		{#if user}
			<div class="flex-1">
				<p class="font-semibold">{user.email}</p>
				<p class="text-sm opacity-60">Progress is stored under this account.</p>
			</div>
			<button class="btn btn-outline btn-sm" onclick={logout}>
				<HugeiconsIcon icon={Logout01Icon} size={16} /> Log out
			</button>
		{:else}
			<div class="flex-1">
				<p class="font-semibold">Not logged in</p>
				<p class="text-sm opacity-60">Log in for per-account progress.</p>
			</div>
			<button class="btn btn-primary btn-sm" onclick={() => goto(resolve('/login'))}>
				Log in
			</button>
		{/if}
	</div>
</div>

<div class="card mb-4 bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title">Appearance</h2>
		<p class="text-sm opacity-70">Pick from all 35 DaisyUI themes. Saved in this browser.</p>
		<div class="mt-2"><ThemeSelect /></div>
	</div>
</div>

<div class="card mb-4 bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title">
			<HugeiconsIcon icon={Key01Icon} size={22} /> AI provider
		</h2>
		<p class="text-sm opacity-70">
			Your key is stored only in this browser's localStorage and sent only to the provider you
			choose. Without a key the app runs in demo mode.
		</p>

		<div class="my-3 grid gap-2 sm:grid-cols-2">
			{#each PROVIDERS as p (p.id)}
				<button
					class="btn justify-start {settings.provider === p.id ? 'btn-primary' : 'btn-outline'}"
					onclick={() => pickProvider(p.id)}
				>
					{p.name}
				</button>
			{/each}
		</div>

		{#each PROVIDERS.filter((p) => p.id === settings.provider) as p (p.id)}
			<p class="mb-3 text-sm opacity-70">
				{p.description}
				<a class="link" href={p.keyUrl} target="_blank" rel="noreferrer">Get a key →</a>
			</p>
		{/each}

		<label class="fieldset w-full max-w-md">
			<legend class="fieldset-legend">Model</legend>
			<div class="flex gap-2">
				<input
					class="input flex-1"
					bind:value={settings.model}
					list="model-list"
					onchange={save}
					autocomplete="off"
					spellcheck={false}
				/>
				<datalist id="model-list">
					{#each PROVIDERS.find((p) => p.id === settings.provider)?.models ?? [] as m (m)}
						<option value={m}></option>
					{/each}
				</datalist>
			</div>
		</label>

		{#if settings.provider === 'compatible'}
			<label class="fieldset mt-2 w-full max-w-md">
				<legend class="fieldset-legend">Base URL</legend>
				<input
					class="input"
					placeholder="https://openrouter.ai/api/v1  or  http://localhost:11434/v1"
					bind:value={settings.baseURL}
					onchange={save}
				/>
			</label>
		{/if}

		{#if settings.provider === 'compatible' || settings.provider === 'opencode-go'}
			<label class="fieldset mt-2 w-full max-w-md">
				<legend class="fieldset-legend">CORS proxy URL (optional)</legend>
				<input
					class="input"
					placeholder="https://lingocloze-proxy.<you>.workers.dev — needed on static hosting"
					bind:value={settings.proxyUrl}
					onchange={save}
					autocomplete="off"
					spellcheck={false}
				/>
				<p class="mt-1 text-xs opacity-60">
					{#if settings.provider === 'opencode-go'}
						Automatic: Supabase Edge Function. Override only to use your own proxy.
					{:else}
						Only needed where the app has no server route (e.g. surge.sh) for gateways
						without CORS headers. See worker/ to self-host one free.
					{/if}
				</p>
			</label>
		{/if}

		<label class="fieldset mt-2 w-full max-w-md">
			<legend class="fieldset-legend">API key</legend>
			<div class="flex w-full gap-2">
				<input
					class="input flex-1"
					type={showKey ? 'text' : 'password'}
					placeholder={PROVIDERS.find((p) => p.id === settings.provider)?.placeholder}
					bind:value={settings.apiKey}
					onchange={save}
					autocomplete="off"
					spellcheck={false}
					data-1p-ignore="true"
					data-lpignore="true"
					data-bwignore="true"
				/>
				<button class="btn" onclick={() => (showKey = !showKey)} aria-label="Show key">
					{#key showKey}
						<HugeiconsIcon icon={showKey ? ViewOffIcon : ViewIcon} size={18} />
					{/key}
				</button>
			</div>
		</label>

		<div class="mt-3 flex items-center gap-2 text-sm">
			{#if hasApiKey(settings)}
				<span class="badge badge-success">ready</span>
			{:else}
				<span class="badge badge-warning">demo mode</span>
			{/if}
			{#if savedTick}<span class="inline-flex items-center gap-1 opacity-60">
					<HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} /> saved</span
				>{/if}
		</div>
	</div>
</div>

<div class="card mb-4 bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title">
			<HugeiconsIcon icon={FloppyDiskIcon} size={22} /> Local data
		</h2>
		<p class="text-sm opacity-70">
			All progress lives in a local database on this device (SQLite on native builds via
			@capacitor-community/sqlite, localStorage-backed store on web).
		</p>
		<div class="mt-2 flex flex-wrap gap-2">
			<button class="btn btn-outline btn-sm" onclick={downloadBackup}>Export backup</button>
			<label class="btn btn-outline btn-sm">
				Import backup
				<input type="file" accept="application/json" class="hidden" onchange={restoreBackup} />
			</label>
			<button class="btn btn-outline btn-error btn-sm" onclick={wipe}>Delete everything</button>
		</div>
		{#if ioError}<p class="mt-2 text-sm text-error">{ioError}</p>{/if}
	</div>
</div>

<a href={resolve('/')} class="btn btn-ghost">← Back home</a>

<p class="mt-6 text-center font-mono text-xs opacity-40">build {__BUILD_ID__}</p>
