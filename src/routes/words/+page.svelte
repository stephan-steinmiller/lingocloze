<script lang="ts">
	import { resolve } from '$app/paths';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SproutIcon, StarIcon } from '@hugeicons/core-free-icons';
	import LanguageSelect from '$lib/components/LanguageSelect.svelte';
	import { getLanguage, searchWords, setWordProficiency, upsertWord } from '$lib/db/database';
	import { getActiveLanguageId, getDbRevision, touchDb } from '$lib/stores/app.svelte';

	type Filter = 'all' | 'known' | 'learning' | 'new';

	let rev = $derived(getDbRevision());
	let activeId = $derived(getActiveLanguageId());
	let lang = $derived.by(() => {
		void rev;
		return activeId ? getLanguage(activeId) : undefined;
	});

	let query = $state('');
	let filter = $state<Filter>('all');
	let newWord = $state('');
	let newTranslation = $state('');

	let words = $derived.by(() => {
		void rev;
		if (!activeId) return [];
		let list = searchWords(activeId, query);
		if (filter === 'known') list = list.filter((w) => w.proficiency >= 3);
		else if (filter === 'learning')
			list = list.filter((w) => w.proficiency >= 1 && w.proficiency < 3);
		else if (filter === 'new') list = list.filter((w) => w.proficiency === 0);
		return list.sort((a, b) => b.updatedAt - a.updatedAt);
	});

	function setLevel(id: string, level: number): void {
		setWordProficiency(id, level);
		touchDb();
	}

	function addManual(): void {
		if (!activeId || !newWord.trim()) return;
		upsertWord({
			languageId: activeId,
			text: newWord.trim(),
			translation: newTranslation.trim() || '—',
			proficiency: 2,
			source: 'manual'
		});
		newWord = '';
		newTranslation = '';
		touchDb();
	}
</script>

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">Word database</h1>
	<LanguageSelect compact />
</div>

{#if !lang}
	<div class="alert alert-info">
		<HugeiconsIcon icon={SproutIcon} size={20} /><span
			><a class="link" href={resolve('/onboarding')}>Add a language</a> to track words.</span
		>
	</div>
{:else}
	<p class="mb-3 text-sm opacity-70">
		{lang.knownWordCount} known · {words.length} shown. Tap stars to adjust a word's proficiency.
	</p>

	<div class="mb-3 flex flex-col gap-2 sm:flex-row">
		<input
			class="input flex-1"
			placeholder="Search words or translations…"
			bind:value={query}
		/>
		<div class="flex flex-wrap gap-1">
			{#each [['all', 'All'], ['known', 'Known'], ['learning', 'Learning'], ['new', 'New']] as [v, label] (v)}
				<button
					class="btn btn-sm {filter === v ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => (filter = v as Filter)}>{label}</button
				>
			{/each}
		</div>
	</div>

	<div class="card mb-4 bg-base-100 shadow-sm">
		<div class="card-body flex-row flex-wrap items-end gap-2 px-4 py-3">
			<label class="fieldset">
				<legend class="fieldset-legend text-xs">Word ({lang.name})</legend>
				<input
					class="input input-sm"
					bind:value={newWord}
					placeholder="e.g. libro"
				/>
			</label>
			<label class="fieldset">
				<legend class="fieldset-legend text-xs">Translation</legend>
				<input
					class="input input-sm"
					bind:value={newTranslation}
					placeholder="e.g. book"
				/>
			</label>
			<div class="fieldset">
				<div class="fieldset-legend text-xs" aria-hidden="true">&nbsp;</div>
				<button class="btn btn-outline btn-sm" onclick={addManual}>+ Add</button>
			</div>
		</div>
	</div>

	{#if words.length === 0}
		<p class="py-10 text-center opacity-60">
			No words match. Generate cloze decks or read stories to grow this list.
		</p>
	{:else}
		<div class="grid gap-2">
			{#each words.slice(0, 200) as w (w.id)}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body flex-row flex-wrap items-center gap-3 px-4 py-2">
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">{w.text}</p>
							<p class="truncate text-sm opacity-60">
								{w.translation}{w.pos ? ` · ${w.pos}` : ''} · from {w.source}
							</p>
						</div>
						<div
							class="flex items-center gap-0.5"
							role="radiogroup"
							aria-label="Proficiency for {w.text}"
						>
							{#each [1, 2, 3, 4, 5] as n (n)}
								<button
									class={n <= w.proficiency ? 'text-warning' : 'opacity-25'}
									onclick={() => setLevel(w.id, n)}
									aria-label={`Set proficiency ${n}`}
								>
									<HugeiconsIcon icon={StarIcon} size={22} />
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/each}
			{#if words.length > 200}<p class="text-center text-sm opacity-60">
					…and {words.length - 200} more (refine search)
				</p>{/if}
		</div>
	{/if}
{/if}
