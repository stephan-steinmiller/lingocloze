<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { animate } from 'motion';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Alert02Icon, Idea01Icon } from '@hugeicons/core-free-icons';
	import { SUPPORTED_LANGUAGES } from '$lib/db/languages';
	import { ACTFL_DESCRIPTIONS, actflToStoryLevel } from '$lib/actfl';
	import { createLanguage, getLanguages, upsertWord } from '$lib/db/database';
	import { loadSettings } from '$lib/ai/providers';
	import { generateVocabChecklist, refineProficiencyWithAI } from '$lib/ai/generate';
	import { assessProficiency, hasSeedVocab, type ProficiencyResult } from '$lib/ai/offline';
	import type { VocabWordAI } from '$lib/ai/schemas';
	import type { ActflLevel } from '$lib/actfl';
	import { setActiveLanguageId, touchDb } from '$lib/stores/app.svelte';

	type Step = 'pick' | 'check' | 'result';

	let step: Step = $state('pick');
	let code = $state('');
	let loadingList = $state(false);
	let assessing = $state(false);
	let loadError = $state('');
	let checklist = $state<VocabWordAI[]>([]);
	let knownSet = $state<Set<string>>(new Set());
	let usedDemoList = $state(false);
	let result = $state<(ProficiencyResult & { aiRefined: boolean }) | null>(null);
	let resultEl: HTMLElement | undefined = $state();

	const existing = new Set(getLanguages().map((l) => l.id));
	const langName = (c: string) => SUPPORTED_LANGUAGES.find((l) => l.code === c)?.name ?? c;

	async function startCheck(selected: string): Promise<void> {
		code = selected;
		loadError = '';
		loadingList = true;
		step = 'check';
		knownSet = new Set();
		try {
			const { words, demo } = await generateVocabChecklist(loadSettings(), code, 24);
			checklist = words;
			usedDemoList = demo;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not build the checklist.';
			checklist = [];
		} finally {
			loadingList = false;
		}
	}

	function toggle(word: string): void {
		const next = new Set(knownSet);
		if (next.has(word)) next.delete(word);
		else next.add(word);
		knownSet = next;
	}

	function toggleTier(tier: number): void {
		const tierWords = checklist.filter((w) => w.tier === tier).map((w) => w.text);
		const allKnown = tierWords.every((w) => knownSet.has(w));
		const next = new Set(knownSet);
		for (const w of tierWords) {
			if (allKnown) next.delete(w);
			else next.add(w);
		}
		knownSet = next;
	}

	async function assess(): Promise<void> {
		assessing = true;
		const base = assessProficiency(checklist, knownSet);
		try {
			const refined = await refineProficiencyWithAI(
				loadSettings(),
				code,
				checklist,
				[...knownSet],
				base
			);
			result = { ...refined, aiRefined: refined.rationale !== base.rationale };
		} catch {
			result = { ...base, aiRefined: false };
		} finally {
			assessing = false;
			step = 'result';
			requestAnimationFrame(() => {
				if (resultEl) animate(resultEl, { opacity: [0, 1], scale: [0.96, 1] }, { duration: 0.4 });
			});
		}
	}

	async function finish(): Promise<void> {
		if (!result) return;
		const level: ActflLevel = result.level;
		const name = langName(code);
		const lang = createLanguage({ code, name, level, levelScore: result.score });
		// Persist the checklist into the word database.
		for (const w of checklist) {
			upsertWord({
				languageId: lang.id,
				text: w.text,
				translation: w.translation,
				pos: w.pos,
				proficiency: knownSet.has(w.text) ? 3 : 0,
				source: 'onboarding'
			});
		}
		// Align story difficulty with assessed level, nudged by score.
		const { clampStoryLevel } = await import('$lib/db/languages');
		const { updateLanguage } = await import('$lib/db/database');
		updateLanguage(lang.id, { storyLevel: clampStoryLevel(actflToStoryLevel(level)) });
		setActiveLanguageId(lang.id);
		touchDb();
		await goto(resolve('/'));
	}

	function startBeginner(): void {
		result = {
			level: 'Novice Low',
			score: 2,
			rationale: 'Starting fresh as a complete beginner.',
			aiRefined: false
		};
		step = 'result';
	}
</script>

<h1 class="mb-1 text-2xl font-bold">Add a language</h1>
<p class="mb-6 opacity-70">Tap every word you know — AI places you on the ACTFL scale.</p>

{#if step === 'pick'}
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#each SUPPORTED_LANGUAGES as l (l.code)}
			<button
				class="btn h-auto justify-start btn-outline py-3 {existing.has(l.code)
					? 'btn-disabled'
					: ''}"
				disabled={existing.has(l.code)}
				onclick={() => startCheck(l.code)}
			>
				<span class="text-2xl">{l.flag}</span>
				<span class="text-left">
					<span class="block font-semibold">{l.name}</span>
					<span class="block text-xs opacity-60">
						{existing.has(l.code)
							? 'already added'
							: hasSeedVocab(l.code)
								? 'works offline'
								: 'needs API key'}
					</span>
				</span>
			</button>
		{/each}
	</div>
{:else if step === 'check'}
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-bold">
			Which {langName(code)} words do you know?
		</h2>
		<button class="btn btn-ghost btn-sm" onclick={() => (step = 'pick')}>← change</button>
	</div>

	{#if loadingList}
		<div class="flex flex-col items-center gap-3 py-16">
			<span class="loading loading-lg loading-spinner text-primary"></span>
			<p class="text-sm opacity-60">AI is picking frequency-tiered words…</p>
		</div>
	{:else if loadError}
		<div role="alert" class="mb-4 alert alert-error">
			<HugeiconsIcon icon={Alert02Icon} size={20} /><span>{loadError}</span>
		</div>
		<button class="btn btn-primary" onclick={startBeginner}>Start as complete beginner (Novice Low)</button>
	{:else}
		{#if usedDemoList}
			<div role="alert" class="mb-3 alert text-sm alert-info">
				<HugeiconsIcon icon={Idea01Icon} size={18} /><span
					>Offline word list — add an API key for AI-picked words.</span
				>
			</div>
		{/if}
		<p class="mb-3 text-sm opacity-70">
			<span class="badge badge-primary">{knownSet.size}/{checklist.length} known</span>
			Be honest — unknown words become your first lessons.
		</p>
		{#each [1, 2, 3, 4] as tier (tier)}
			<div class="mb-3">
				<div class="mb-1 flex items-center justify-between">
					<p class="text-xs font-bold tracking-wide uppercase opacity-60">
						{tier === 1
							? 'Everyday'
							: tier === 2
								? 'Common'
								: tier === 3
									? 'Intermediate'
									: 'Advanced'}
					</p>
					<button class="btn btn-ghost btn-xs" onclick={() => toggleTier(tier)}>toggle tier</button>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each checklist.filter((w) => w.tier === tier) as w (w.text)}
						<button
							class="btn btn-sm {knownSet.has(w.text) ? 'btn-primary' : 'btn-outline'}"
							onclick={() => toggle(w.text)}
							title={w.translation}
						>
							{w.text}
							<span class="hidden font-normal opacity-60 sm:inline">· {w.translation}</span>
						</button>
					{/each}
				</div>
			</div>
		{/each}
		<div class="sticky bottom-20 mt-6 flex gap-2 lg:bottom-6">
			<button class="btn flex-1 btn-ghost" onclick={startBeginner}>I'm a beginner</button>
			<button class="btn flex-1 btn-primary" disabled={assessing} onclick={assess}>
				{#if assessing}<span class="loading loading-sm loading-spinner"></span>{/if}
				Assess my level
			</button>
		</div>
	{/if}
{:else if step === 'result' && result}
	<div bind:this={resultEl} class="card bg-base-100 shadow-lg">
		<div class="card-body items-center text-center">
			<div class="text-6xl font-black text-primary">{result.level}</div>
			<p class="text-sm opacity-70">ACTFL placement · {ACTFL_DESCRIPTIONS[result.level]}</p>
			<div
				class="radial-progress my-4 text-primary"
				style="--value:{result.score}; --size:8rem;"
				role="progressbar"
				aria-label="Level score {result.score} of 100"
			>
				{result.score}
			</div>
			<p class="max-w-md">{result.rationale}</p>
			{#if result.aiRefined}
				<span class="mt-1 badge badge-sm badge-success">AI-refined</span>
			{:else}
				<span class="mt-1 badge badge-ghost badge-sm">heuristic</span>
			{/if}
			<div class="mt-4 card-actions w-full">
				<button class="btn w-full btn-lg btn-primary" onclick={finish}>
					Start learning {langName(code)} →
				</button>
			</div>
		</div>
	</div>
{/if}
