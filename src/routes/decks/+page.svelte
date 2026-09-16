<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Alert02Icon,
		CheckmarkCircle02Icon,
		Delete02Icon,
		Layers01Icon,
		SparklesIcon,
		SproutIcon
	} from '@hugeicons/core-free-icons';
	import LanguageSelect from '$lib/components/LanguageSelect.svelte';
	import { TOPIC_SUGGESTIONS } from '$lib/db/languages';
	import {
		deleteDeck,
		getCards,
		getDecks,
		getDueCards,
		getLanguage
	} from '$lib/db/database';
	import { dismissJob, getJobsFor, startClozeJob } from '$lib/stores/jobs.svelte';
	import { getActiveLanguageId, getDbRevision, touchDb } from '$lib/stores/app.svelte';

	let rev = $derived(getDbRevision());
	let activeId = $derived(getActiveLanguageId());
	let lang = $derived.by(() => {
		void rev;
		return activeId ? getLanguage(activeId) : undefined;
	});
	let decks = $derived.by(() => {
		void rev;
		return lang ? getDecks(lang.id) : [];
	});
	// Background jobs for this language (running + recent finished).
	let jobs = $derived.by(() => {
		void rev;
		return getJobsFor('cloze', lang?.id);
	});

	// New-deck form
	let topic = $state(TOPIC_SUGGESTIONS[0]);
	let customTopic = $state('');
	let count = $state(10);

	const effectiveTopic = () => (customTopic.trim() ? customTopic.trim() : topic);

	function create(): void {
		if (!lang) return;
		// Fire-and-forget: the job survives navigation, so head home at once.
		startClozeJob({ languageId: lang.id, topic: effectiveTopic(), count });
		count = 10;
		customTopic = '';
		void goto(resolve('/'));
	}

	async function remove(id: string): Promise<void> {
		if (!confirm('Delete this deck and its cards?')) return;
		deleteDeck(id);
		touchDb();
	}

	function dueIn(deckId: string): number {
		void rev;
		return getDueCards(undefined, deckId, 1000).length;
	}
	function totalIn(deckId: string): number {
		void rev;
		return getCards(deckId).length;
	}
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">Cloze decks</h1>
	<LanguageSelect compact />
</div>

{#if !lang}
	<div class="alert alert-info">
		<HugeiconsIcon icon={SproutIcon} size={20} /><span
			><a class="link" href={resolve('/onboarding')}>Add a language</a> to create decks.</span
		>
	</div>
{:else}
	<div class="card mb-6 bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title">
				<HugeiconsIcon icon={SparklesIcon} size={22} /> Generate with AI
			</h2>
			<p class="text-sm opacity-60">
				Runs in the background — start it here, browse elsewhere, come back when it's done.
			</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="fieldset">
					<legend class="fieldset-legend">Topic</legend>
					<select class="select" bind:value={topic}>
						{#each TOPIC_SUGGESTIONS as t (t)}<option value={t}>{t}</option>{/each}
					</select>
				</label>
				<label class="fieldset">
					<legend class="fieldset-legend">…or your own topic</legend>
					<input
						class="input "
						placeholder="e.g. ordering coffee in Lisbon"
						bind:value={customTopic}
					/>
				</label>
				<label class="fieldset">
					<legend class="fieldset-legend">Cards: {count}</legend>
					<input
						type="range"
						min="5"
						max="20"
						step="1"
						class="range range-primary"
						bind:value={count}
					/>
				</label>
				<div class="flex items-end">
					<p class="pb-2 text-sm opacity-60">Level {lang.level} · avoids your known words</p>
				</div>
			</div>
			<div class="mt-3 card-actions">
				<button class="btn btn-primary" onclick={create}>Generate {count} cards</button>
			</div>
		</div>
	</div>

	{#if jobs.length > 0}
		<div class="grid gap-2 mb-4">
			{#each jobs as j (j.id)}
				<div
					class="card shadow-sm {j.status === 'error'
						? 'bg-error/10'
						: j.status === 'done'
							? 'bg-success/10'
							: 'bg-base-100'}"
				>
					<div class="card-body flex-row items-center gap-3 px-4 py-3">
						{#if j.status === 'running'}
							<span class="loading loading-spinner loading-sm text-primary"></span>
							<p class="flex-1 text-sm">
								Generating {j.count} cards about “{j.topic}”… you can leave this page.
							</p>
						{:else if j.status === 'done'}
							<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} class="text-success" />
							<p class="flex-1 text-sm">
								{j.count} cards about “{j.topic}” ready{#if j.demo} (demo content){/if}.
							</p>
							{#if j.deckId}
								<a href={resolve(`/review?deck=${j.deckId}`)} class="btn btn-primary btn-sm"
									>Review now</a
								>
							{/if}
							<button class="btn btn-ghost btn-sm" onclick={() => dismissJob(j.id)}>Dismiss</button>
						{:else}
							<HugeiconsIcon icon={Alert02Icon} size={20} class="text-error" />
							<p class="flex-1 text-sm">{j.error}</p>
							<button class="btn btn-ghost btn-sm" onclick={() => dismissJob(j.id)}>Dismiss</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if decks.length === 0}
		<div class="py-10 text-center opacity-60">
			<div class="mb-2 flex justify-center opacity-70">
				<HugeiconsIcon icon={Layers01Icon} size={56} />
			</div>
			<p>No decks yet — generate your first one above.</p>
		</div>
	{:else}
		<div class="grid gap-2">
			{#each decks as d (d.id)}
				{@const due = dueIn(d.id)}
				{@const total = totalIn(d.id)}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body flex-row flex-wrap items-center gap-2 px-4 py-3 sm:gap-3">
						<div class="flex-1">
							<p class="font-semibold">{d.title}</p>
							<p class="text-sm opacity-60">{total} cards · {due} due</p>
						</div>
						{#if due > 0}<span class="badge badge-primary">{due} due</span>{/if}
						<a href={resolve(`/review?deck=${d.id}`)} class="btn btn-primary btn-sm">Review</a>
						<a href={resolve(`/decks/${d.id}`)} class="btn btn-ghost btn-sm">Details</a>
						<button
							class="btn btn-sm btn-ghost text-error"
							onclick={() => remove(d.id)}
							aria-label="Delete deck"
						>
							<HugeiconsIcon icon={Delete02Icon} size={18} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}
