<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { animate } from 'motion';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Alert02Icon,
		AnalyticsUpIcon,
		BookOpen01Icon,
		Cards01Icon,
		CheckmarkCircle02Icon,
		CrownIcon,
		Key01Icon,
		Layers01Icon,
		SproutIcon,
		SwatchBookIcon
	} from '@hugeicons/core-free-icons';
	import LanguageSelect from '$lib/components/LanguageSelect.svelte';
	import { getActiveLanguageId, getDbRevision, touchDb } from '$lib/stores/app.svelte';
	import {
		dueCount,
		getDecks,
		getLanguage,
		getReviewLogs,
		getStories,
		getWords,
		setLanguageLevel
	} from '$lib/db/database';
	import {
		ACTFL_DESCRIPTIONS,
		ACTFL_LEVELS,
		promotionEligibility,
		type ActflLevel
	} from '$lib/actfl';
	import { dismissJob, getJobs } from '$lib/stores/jobs.svelte';
	import { hasApiKey, loadSettings } from '$lib/ai/providers';

	let heroEl: HTMLElement | undefined = $state();

	onMount(() => {
		if (heroEl) {
			animate(heroEl, { opacity: [0, 1], y: [16, 0] }, { duration: 0.5, ease: 'easeOut' });
		}
	});

	// Re-read whenever the db revision changes (mutations call touchDb()).
	let rev = $derived(getDbRevision());
	let activeId = $derived(getActiveLanguageId());
	let lang = $derived.by(() => {
		void rev;
		return activeId ? getLanguage(activeId) : undefined;
	});
	let due = $derived.by(() => {
		void rev;
		return lang ? dueCount(lang.id) : 0;
	});
	let decks = $derived.by(() => {
		void rev;
		return lang ? getDecks(lang.id) : [];
	});
	let stories = $derived.by(() => {
		void rev;
		return lang ? getStories(lang.id).slice(0, 3) : [];
	});
	let known = $derived(lang ? lang.knownWordCount : 0);
	let totalWords = $derived.by(() => {
		void rev;
		return lang ? getWords(lang.id).length : 0;
	});
	// Promotion progress toward the next sublevel.
	let promo = $derived.by(() => {
		void rev;
		if (!lang) return null;
		const window = getReviewLogs(lang.id, 40).slice(0, 20);
		const correct = window.filter((l) => l.correct).length;
		return promotionEligibility(lang.level, lang.knownWordCount, correct, window.length);
	});
	// Background generation jobs (running + recent finished, all languages).
	let jobs = $derived.by(() => {
		void rev;
		return getJobs();
	});
	let needsKey = $derived(!hasApiKey(loadSettings()));

	function adjustLevel(e: Event): void {
		if (!lang) return;
		setLanguageLevel(lang.id, (e.target as HTMLSelectElement).value as ActflLevel);
		touchDb();
	}
</script>

<div bind:this={heroEl}>
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-3xl font-bold">Learn with cloze <span class="text-primary">✦</span></h1>
			<p class="mt-1 opacity-70">
				AI-generated fill-in-the-blank cards, spaced repetition, stories.
			</p>
		</div>
		<LanguageSelect />
	</div>

	{#if !lang}
		<div class="hero rounded-3xl bg-base-100 shadow-sm">
			<div class="hero-content py-12 text-center">
				<div class="max-w-md">
					<div class="mb-4 flex justify-center text-success">
						<HugeiconsIcon icon={SproutIcon} size={64} />
					</div>
					<h2 class="text-2xl font-bold">Start your first language</h2>
					<p class="py-4 opacity-70">
						Pick a target language, tap every word you already know, and the AI will place you on
						the ACTFL scale. Then generate your first cloze deck.
					</p>
					<a href={resolve('/onboarding')} class="btn btn-primary">Begin onboarding</a>
				</div>
			</div>
		</div>
	{:else}
		{#if needsKey}
			<div role="alert" class="mb-4 alert alert-warning">
				<HugeiconsIcon icon={Key01Icon} size={20} />
				<div>
					<p class="font-semibold">Demo mode — no API key yet</p>
					<p class="text-sm">
						Add your own key in <a class="link" href={resolve('/settings')}>Settings</a> to generate
						real {lang.name} content. Your key stays in this browser.
					</p>
				</div>
			</div>
		{/if}

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
									{j.kind === 'story' ? 'Writing' : `Generating ${j.count} cards`} · “{j.topic}”
									({j.languageName})…
								</p>
							{:else if j.status === 'done'}
								<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} class="text-success" />
								<p class="flex-1 text-sm">
									{j.kind === 'story' ? 'Story' : `${j.count} cards`} · “{j.topic}” ready{#if j.demo}
										(demo){/if}.
								</p>
								{#if j.deckId}
									<a href={resolve(`/review?deck=${j.deckId}`)} class="btn btn-primary btn-sm"
										>Review now</a
									>
								{/if}
								{#if j.storyId}
									<a href={resolve(`/stories/${j.storyId}`)} class="btn btn-primary btn-sm"
										>Read now</a
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

		<div class="stats mb-4 w-full stats-vertical bg-base-100 shadow sm:stats-horizontal">
			<div class="stat">
				<div class="stat-title">Due for review</div>
				<div class="stat-value text-primary">{due}</div>
				<div class="stat-desc">across {decks.length} deck{decks.length === 1 ? '' : 's'}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Words known</div>
				<div class="stat-value">{known}</div>
				<div class="stat-desc">{totalWords} tracked</div>
			</div>
			<div class="stat">
				<div class="stat-title">Level</div>
				<div class="stat-value text-lg leading-tight">{lang.level}</div>
				<div class="stat-desc">score {lang.levelScore}/100</div>
			</div>
		</div>

		<div class="card mb-4 bg-base-100 shadow-sm">
			<div class="card-body px-4 py-3">
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="flex items-center gap-1 font-bold">
						<HugeiconsIcon icon={AnalyticsUpIcon} size={20} /> Proficiency
					</h2>
					<span class="badge badge-outline">{ACTFL_DESCRIPTIONS[lang.level]}</span>
				</div>
				<div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
					<label class="fieldset flex-1">
						<legend class="fieldset-legend text-xs">Adjust level manually</legend>
						<select class="select" value={lang.level} onchange={adjustLevel}>
							{#each ACTFL_LEVELS as l (l)}<option value={l}>{l}</option>{/each}
						</select>
					</label>
				</div>
				{#if promo && promo.next}
					<div class="mt-2">
						<p class="text-sm">
							Next: <span class="font-semibold">{promo.next}</span> — {promo.haveWords}/{promo.needWords}
							known words · {Math.round(promo.recall * 100)}% recall ({promo.reviewCount}/20+ reviews)
						</p>
						<progress
							class="progress progress-primary mt-1 w-full"
							value={Math.min(promo.haveWords, promo.needWords)}
							max={promo.needWords}
						></progress>
						{#if promo.reasons.length > 0}
							<p class="mt-1 text-xs opacity-60">Auto-promotion is strict: {promo.reasons[0]}</p>
						{:else}
							<p class="mt-1 text-xs opacity-60">
								Gates passed — finish reviews and the AI will confirm the promotion.
							</p>
						{/if}
					</div>
				{:else}
					<p class="mt-2 flex items-center gap-1 text-sm opacity-60">
						Top of the scale — Distinguished.
						<HugeiconsIcon icon={CrownIcon} size={16} />
					</p>
				{/if}
			</div>
		</div>

		<div class="mb-6 grid gap-3 sm:grid-cols-2">
			<a
				href={resolve('/review')}
				class="btn btn-lg btn-primary {due === 0 ? 'btn-disabled' : ''}"
				aria-disabled={due === 0}
			>
				<HugeiconsIcon icon={Cards01Icon} size={24} /> Review {due > 0
					? `(${due})`
					: '— all clear!'}
			</a>
			<a href={resolve('/decks')} class="btn btn-outline btn-lg">
				<HugeiconsIcon icon={Layers01Icon} size={24} /> New cloze deck
			</a>
			<a href={resolve('/stories')} class="btn btn-outline btn-lg">
				<HugeiconsIcon icon={BookOpen01Icon} size={24} /> Story mode
			</a>
			<a href={resolve('/words')} class="btn btn-outline btn-lg">
				<HugeiconsIcon icon={SwatchBookIcon} size={24} /> Word database
			</a>
		</div>

		{#if stories.length > 0}
			<h2 class="mb-2 font-bold">Recent stories</h2>
			<div class="grid gap-2">
				{#each stories as s (s.id)}
					<a
						href={resolve(`/stories/${s.id}`)}
						class="card bg-base-100 shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="card-body px-4 py-3">
							<p class="font-semibold">{s.title}</p>
							<p class="text-sm opacity-60">{s.topic} · difficulty {s.level}/10</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
