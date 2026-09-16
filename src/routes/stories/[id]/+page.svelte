<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { animate } from 'motion';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Alert02Icon, ConfusedIcon, Idea01Icon } from '@hugeicons/core-free-icons';
	import {
		getAttempts,
		getLanguage,
		getQuestions,
		getStory,
		saveAttempt,
		updateLanguage
	} from '$lib/db/database';
	import { adjustStoryLevel } from '$lib/ai/offline';
	import { storyLevelToActfl } from '$lib/actfl';
	import { touchDb } from '$lib/stores/app.svelte';

	let storyId = $derived(page.params.id);
	let story = $derived(storyId ? getStory(storyId) : undefined);
	let questions = $derived(storyId ? getQuestions(storyId) : []);
	let lang = $derived(story ? getLanguage(story.languageId) : undefined);
	let attempts = $derived(storyId ? getAttempts(storyId) : []);

	let showTranslation = $state(false);
	/** answers[i]: number | null (null = unanswered) */
	let answers = $state<Array<number | null>>([]);
	let submitted = $state(false);
	let score = $state(0);
	let newLevel = $state(0);
	let resultEl: HTMLElement | undefined = $state();

	$effect(() => {
		answers = questions.map(() => null);
		submitted = false;
		showTranslation = false;
	});

	function choose(i: number, opt: number): void {
		if (submitted) return;
		const next = [...answers];
		next[i] = opt;
		answers = next;
	}

	function submit(understood: boolean): void {
		if (!story || !lang || submitted) return;
		const final = questions.map((_, i) => (understood ? (answers[i] ?? -1) : -1));
		let s = 0;
		questions.forEach((q, i) => {
			if (final[i] === q.correctIndex) s += 1;
		});
		const next = adjustStoryLevel(lang.storyLevel, s, questions.length, understood);
		saveAttempt({
			storyId: story.id,
			languageId: story.languageId,
			answers: final,
			score: s,
			understood,
			storyLevelAfter: next
		});
		updateLanguage(lang.id, { storyLevel: next });
		score = s;
		newLevel = next;
		submitted = true;
		touchDb();
		requestAnimationFrame(() => {
			if (resultEl) animate(resultEl, { opacity: [0, 1], y: [12, 0] }, { duration: 0.35 });
			resultEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	function retry(): void {
		answers = questions.map(() => null);
		submitted = false;
	}
</script>

<a href={resolve('/stories')} class="btn mb-3 btn-ghost btn-sm">← All stories</a>

{#if !story}
	<div class="alert alert-error">
		<HugeiconsIcon icon={Alert02Icon} size={20} /><span>Story not found.</span>
	</div>
{:else}
	<div class="card mb-4 bg-base-100 shadow-lg">
		<div class="card-body">
			<div class="mb-1 flex flex-wrap items-center gap-2">
				<h1 class="flex-1 text-2xl font-bold">{story.title}</h1>
				<span class="badge badge-primary">difficulty {story.level}/10</span>
			</div>
			<p class="mb-3 text-sm opacity-60">{story.titleTranslation} · {story.topic}</p>
			<div class="story-body whitespace-pre-line">{story.body}</div>
			{#if story.translation}
				<div class="mt-3">
					<button class="btn btn-ghost btn-sm" onclick={() => (showTranslation = !showTranslation)}>
						{showTranslation ? 'Hide' : 'Show'} English translation
					</button>
					{#if showTranslation}<p class="mt-2 text-sm whitespace-pre-line opacity-70">
							{story.translation}
						</p>{/if}
				</div>
			{/if}
		</div>
	</div>

	<h2 class="mb-2 text-lg font-bold">Check your understanding</h2>
	{#each questions as q, i (q.id)}
		<div class="card mb-2 bg-base-100 shadow-sm">
			<div class="card-body px-4 py-3">
				<p class="font-semibold">Q{i + 1}. {q.question}</p>
				<p class="mb-2 text-xs opacity-60">{q.questionTranslation}</p>
				<div class="grid gap-1">
					{#each q.options as opt, o (o)}
						{@const picked = answers[i] === o}
						{@const showRight = submitted && o === q.correctIndex}
						{@const showWrong = submitted && picked && o !== q.correctIndex}
						<button
							class="btn h-auto min-h-8 justify-start font-normal whitespace-normal btn-sm {showRight
								? 'btn-success'
								: showWrong
									? 'btn-error'
									: picked
										? 'btn-primary'
										: 'btn-outline'}"
							disabled={submitted}
							onclick={() => choose(i, o)}
						>
							{opt}
						</button>
					{/each}
				</div>
				{#if submitted && q.explanation}
					<p class="mt-2 flex items-center gap-1 text-xs opacity-70">
						<HugeiconsIcon icon={Idea01Icon} size={14} /> {q.explanation}
					</p>
				{/if}
			</div>
		</div>
	{/each}

	{#if !submitted}
		<div class="mt-3 flex flex-col gap-2 sm:flex-row">
			<button class="btn flex-1 btn-primary" onclick={() => submit(true)}>Check answers</button>
			<button class="btn flex-1 btn-outline btn-warning" onclick={() => submit(false)}>
				<HugeiconsIcon icon={ConfusedIcon} size={18} /> I did not understand
			</button>
		</div>
	{:else}
		<div bind:this={resultEl} class="card mt-3 bg-base-100 shadow-md">
			<div class="card-body items-center text-center">
				<p class="text-4xl font-black text-primary">{score}/{questions.length}</p>
				<p class="text-sm opacity-70">
					Difficulty {lang?.storyLevel} → <span class="font-bold">{newLevel}/10</span>
					(~{storyLevelToActfl(newLevel)})
				</p>
				<div class="mt-2 flex gap-2">
					<button class="btn btn-ghost" onclick={retry}>Try again</button>
					<a href={resolve('/stories')} class="btn btn-primary">Next story →</a>
				</div>
			</div>
		</div>
	{/if}

	{#if attempts.length > 0}
		<h3 class="mt-6 mb-2 text-sm font-bold tracking-wide uppercase opacity-60">Past attempts</h3>
		<div class="flex flex-wrap gap-2">
			{#each attempts.slice(0, 8) as a (a.id)}
				<span class="badge {a.understood ? 'badge-success' : 'badge-warning'}">
					{a.understood ? `${a.score} pts` : 'not understood'} · {new Date(
						a.createdAt
					).toLocaleDateString()}
				</span>
			{/each}
		</div>
	{/if}
{/if}
