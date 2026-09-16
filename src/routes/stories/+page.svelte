<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Alert02Icon,
		BookOpen01Icon,
		CheckmarkCircle02Icon,
		SproutIcon
	} from '@hugeicons/core-free-icons';
	import LanguageSelect from '$lib/components/LanguageSelect.svelte';
	import { TOPIC_SUGGESTIONS } from '$lib/db/languages';
	import { storyLevelToActfl } from '$lib/actfl';
	import { getLanguage, getStories } from '$lib/db/database';
	import { dismissJob, getJobsFor, startStoryJob } from '$lib/stores/jobs.svelte';
	import { getActiveLanguageId, getDbRevision } from '$lib/stores/app.svelte';

	let rev = $derived(getDbRevision());
	let activeId = $derived(getActiveLanguageId());
	let lang = $derived.by(() => {
		void rev;
		return activeId ? getLanguage(activeId) : undefined;
	});
	let stories = $derived.by(() => {
		void rev;
		return lang ? getStories(lang.id) : [];
	});
	let jobs = $derived.by(() => {
		void rev;
		return getJobsFor('story', lang?.id);
	});

	let topic = $state(TOPIC_SUGGESTIONS[2]);
	let customTopic = $state('');

	const effectiveTopic = () => (customTopic.trim() ? customTopic.trim() : topic);

	function create(): void {
		if (!lang) return;
		// Fire-and-forget: the job survives navigation, so head home at once.
		startStoryJob({ languageId: lang.id, topic: effectiveTopic() });
		customTopic = '';
		void goto(resolve('/'));
	}
</script>

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">Story mode</h1>
	<LanguageSelect compact />
</div>

{#if !lang}
	<div class="alert alert-info">
		<HugeiconsIcon icon={SproutIcon} size={20} /><span
			><a class="link" href={resolve('/onboarding')}>Add a language</a> to read stories.</span
		>
	</div>
{:else}
	<div class="card mb-4 bg-base-100 shadow-sm">
		<div class="card-body">
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="card-title">
					<HugeiconsIcon icon={BookOpen01Icon} size={22} /> New story
				</h2>
				<span class="badge badge-primary"
					>difficulty {lang.storyLevel}/10 · ~{storyLevelToActfl(lang.storyLevel)}</span
				>
			</div>
			<p class="text-sm opacity-70">
				Difficulty adapts to your quiz answers — including “I did not understand”. Runs in the
				background; feel free to leave this page.
			</p>
			<div class="mt-1 grid gap-3 sm:grid-cols-2">
				<label class="fieldset">
					<legend class="fieldset-legend">Topic</legend>
					<select class="select" bind:value={topic}>
						{#each TOPIC_SUGGESTIONS as t (t)}<option value={t}>{t}</option>{/each}
					</select>
				</label>
				<label class="fieldset">
					<legend class="fieldset-legend">…or your own</legend>
					<input
						class="input "
						placeholder="e.g. a lost cat in Barcelona"
						bind:value={customTopic}
					/>
				</label>
			</div>
			<div class="mt-3 card-actions">
				<button class="btn btn-primary" onclick={create}>Generate story</button>
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
							<p class="flex-1 text-sm">Writing a story about “{j.topic}”…</p>
						{:else if j.status === 'done'}
							<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} class="text-success" />
							<p class="flex-1 text-sm">
								Story about “{j.topic}” ready{#if j.demo} (demo content){/if}.
							</p>
							{#if j.storyId}
								<a href={resolve(`/stories/${j.storyId}`)} class="btn btn-primary btn-sm">Read now</a>
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

	{#if stories.length === 0}
		<p class="py-8 text-center opacity-60">No stories yet — generate one above.</p>
	{:else}
		<div class="grid gap-2">
			{#each stories as s (s.id)}
				<a
					href={resolve(`/stories/${s.id}`)}
					class="card bg-base-100 shadow-sm transition-shadow hover:shadow-md"
				>
					<div class="card-body px-4 py-3">
						<p class="font-semibold">{s.title}</p>
						<p class="text-sm opacity-60">
							{s.topic} · difficulty {s.level}/10 · {new Date(s.createdAt).toLocaleDateString()}
						</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}
{/if}
