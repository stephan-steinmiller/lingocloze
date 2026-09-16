<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { animate } from 'motion';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Analytics01Icon,
		Cancel01Icon,
		CheckmarkCircle02Icon,
		Globe02Icon,
		Idea01Icon,
		PartyIcon,
		ReloadIcon,
		SproutIcon,
		SwatchBookIcon
	} from '@hugeicons/core-free-icons';
	import LanguageSelect from '$lib/components/LanguageSelect.svelte';
	import {
		getCards,
		getDeck,
		getDueCards,
		getLanguage,
		getWords,
		logReview,
		setWordProficiency,
		updateCard
	} from '$lib/db/database';
	import type { ClozeCard, ReviewGrade } from '$lib/db/types';
	import { formatInterval, reviewSrs } from '$lib/srs/sm2';
	import { answersMatch, splitCloze } from '$lib/utils/text';
	import { getActiveLanguageId, touchDb } from '$lib/stores/app.svelte';
	import { loadSettings } from '$lib/ai/providers';
	import { judgeAnswer } from '$lib/ai/judge';
	import {
		clearPromotionNotice,
		getPromotionNotice,
		maybePromote
	} from '$lib/ai/promote.svelte';
	import { updateLanguage } from '$lib/db/database';

	let cardEl: HTMLElement | undefined = $state();

	let activeId = $derived(getActiveLanguageId());
	let deckFilter = $derived(page.url.searchParams.get('deck'));

	function buildQueue(): ClozeCard[] {
		const langId = getActiveLanguageId();
		const deck = page.url.searchParams.get('deck');
		if (!langId) return [];
		if (deck) return getDueCards(langId, deck, 100);
		return getDueCards(langId, undefined, 100);
	}

	let cards = $state<ClozeCard[]>([]);
	let index = $state(0);
	let typed = $state('');
	let revealed = $state(false);
	let wasCorrect = $state(false);
	let checking = $state(false);
	let acceptedVariant = $state(false);
	let showHint = $state(false);
	let startedAt = $state(Date.now());
	let sessionDone = $state(0);
	let sessionCorrect = $state(0);
	let sessionRetries = $state(0);
	/** Wrong attempts per card id this session (drives requeue + struggle memory). */
	let mistakes = $state<Record<string, number>>({});
	let deckSize = $state(0);
	const MAX_TRIES = 3;

	function resetSession(): void {
		cards = buildQueue();
		deckSize = deckFilter ? getCards(deckFilter).length : cards.length;
		index = 0;
		typed = '';
		revealed = false;
		sessionDone = 0;
		sessionCorrect = 0;
		sessionRetries = 0;
		mistakes = {};
		checking = false;
		acceptedVariant = false;
		startedAt = Date.now();
	}

	// (Re)build when the language or deck filter changes — but NOT on every
	// db touch (grading calls touchDb; rebuilding would wipe session stats).
	let sessionKey = $derived(`${activeId ?? ''}|${deckFilter ?? ''}`);
	let lastSessionKey = $state('');
	$effect(() => {
		if (sessionKey !== lastSessionKey) {
			lastSessionKey = sessionKey;
			resetSession();
		}
	});

	let card = $derived(cards[index]);
	let parts = $derived(card ? splitCloze(card.sentence) : ['', '']);
	let deckName = $derived(deckFilter ? (getDeck(deckFilter)?.title ?? 'Deck') : null);
	let lang = $derived(activeId ? getLanguage(activeId) : undefined);
	let promo = $derived.by(() => {
		const n = getPromotionNotice();
		return n && n.languageId === activeId ? n : null;
	});
	// Training wheels: show translations while answering. Persisted per language,
	// with a session override so the toggle feels instant.
	let gentleOverride = $state<boolean | null>(null);
	let gentle = $derived(gentleOverride ?? lang?.gentleMode ?? false);

	function toggleGentle(): void {
		const next = !gentle;
		gentleOverride = next;
		if (activeId) {
			updateLanguage(activeId, { gentleMode: next });
			touchDb();
		}
	}

	function flip(next: number): void {
		index = next;
		typed = '';
		revealed = false;
		wasCorrect = false;
		checking = false;
		acceptedVariant = false;
		showHint = false;
		startedAt = Date.now();
		if (cardEl) animate(cardEl, { opacity: [0, 1], x: [24, 0] }, { duration: 0.25 });
	}

	async function check(): Promise<void> {
		if (!card || revealed || !typed.trim() || checking) return;
		// Fast path: exact match (accent/case-insensitive) — no AI cost.
		if (answersMatch(typed, card.answer)) {
			wasCorrect = true;
			acceptedVariant = false;
			revealed = true;
			return;
		}
		// Lenient path: let the AI judge minor misspellings and valid
		// alternatives. Any failure degrades to a plain miss.
		const judging = card;
		const attempt = typed.trim();
		checking = true;
		try {
			const ok = await judgeAnswer(loadSettings(), {
				languageCode: lang?.code ?? activeId ?? '',
				languageName: lang?.name ?? 'the target language',
				sentence: judging.sentence,
				expected: judging.answer,
				typed: attempt,
				translation: judging.translation
			});
			// Only apply if the user is still on the same unrevealed card.
			if (!card || card.id !== judging.id || revealed) return;
			if (ok) {
				wasCorrect = true;
				acceptedVariant = true;
			} else {
				mistakes = { ...mistakes, [judging.id]: (mistakes[judging.id] ?? 0) + 1 };
			}
			revealed = true;
		} finally {
			if (card?.id === judging.id) checking = false;
		}
	}

	function grade(g: ReviewGrade): void {
		if (!card || !revealed || !activeId || !wasCorrect) return;
		const struggled = (mistakes[card.id] ?? 0) > 0;
		const res = reviewSrs(
			{ easeFactor: card.easeFactor, interval: card.interval, repetitions: card.repetitions },
			g,
			Date.now(),
			// Struggle memory: a card missed this session lapses and never
			// jumps further than tomorrow, whatever grade you pick.
			card.lapses + (struggled ? 1 : 0)
		);
		const interval = struggled ? Math.min(res.interval, 1) : res.interval;
		updateCard(card.id, {
			easeFactor: res.easeFactor,
			interval,
			repetitions: res.repetitions,
			dueAt: Date.now() + Math.round(interval * 24 * 60 * 60 * 1000),
			lastReviewedAt: Date.now(),
			lapses: res.lapses
		});
		logReview({
			cardId: card.id,
			languageId: activeId,
			grade: g,
			correct: wasCorrect,
			durationMs: Date.now() - startedAt
		});
		// Mirror recall into the word database.
		if (card.wordText && activeId) {
			const key = card.wordText.trim().toLowerCase();
			const w = getWords(activeId).find((x) => x.text.trim().toLowerCase() === key);
			if (w) {
				// grade() only runs after a correct answer: recall proven.
				setWordProficiency(w.id, w.proficiency + 1);
			}
		}
		sessionDone += 1;
		sessionCorrect += 1; // grade() only runs after a correct answer
		touchDb();
		// Promotion check is a cheap no-op unless the strict gates are crossed.
		if (activeId) void maybePromote(activeId);
		if (index + 1 < cards.length) flip(index + 1);
		else {
			cards = [];
		}
	}

	function preview(g: ReviewGrade): string {		if (!card) return '';
		const res = reviewSrs(
			{ easeFactor: card.easeFactor, interval: card.interval, repetitions: card.repetitions },
			g,
			Date.now(),
			card.lapses
		);
		return formatInterval(res.interval);
	}

	function onKey(e: KeyboardEvent): void {
		if (e.key === 'Enter' && !revealed) check();
	}

	/**
	 * Swap the failed card with a random later card so it comes back later in
	 * this session. No SRS write happens — the card is retried until correct
	 * (max MAX_TRIES attempts, then it simply stays due for next time).
	 */
	function requeue(): void {
		if (!card) return;
		const remaining = cards.length - index - 1;
		if (remaining <= 0) return;
		const swapWith = index + 1 + Math.floor(Math.random() * remaining);
		const next = [...cards];
		next[index] = cards[swapWith];
		next[swapWith] = card;
		cards = next;
		sessionRetries += 1;
		flip(index);
	}

	/** Move on without grading: the card keeps its old due date, so it returns. */
	function skipForNow(): void {
		if (index + 1 < cards.length) flip(index + 1);
		else cards = [];
	}

	function canRequeue(): boolean {
		if (!card) return false;
		return (mistakes[card.id] ?? 0) < MAX_TRIES && index < cards.length - 1;
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">Review {deckName ? `· ${deckName}` : ''}</h1>
	<div class="flex items-center gap-3">
		<label class="flex cursor-pointer items-center gap-1 text-xs opacity-70" title="Show sentence translations while answering">
			<input
				type="checkbox"
				class="toggle toggle-xs"
				checked={gentle}
				onchange={toggleGentle}
			/>
			translations
		</label>
		<LanguageSelect compact />
	</div>
</div>

{#if promo}
	<div
		role="alert"
		class="alert mb-4 {promo.kind === 'promoted'
			? 'alert-success'
			: promo.kind === 'assessing'
				? 'alert-info'
				: 'alert-warning'}"
	>
		{#if promo.kind === 'assessing'}
			<span class="loading loading-spinner loading-sm"></span>
			<span>AI is reviewing your progress for promotion to {promo.to}…</span>
		{:else if promo.kind === 'promoted'}
			<HugeiconsIcon icon={PartyIcon} size={20} />
			<div class="flex-1">
				<p class="font-bold">Promoted: {promo.from} → {promo.to}!</p>
				<p class="text-sm opacity-80">{promo.rationale}</p>
			</div>
			<button class="btn btn-ghost btn-sm" onclick={clearPromotionNotice}>Nice!</button>
		{:else}
			<HugeiconsIcon icon={Analytics01Icon} size={20} />
			<div class="flex-1">
				<p class="font-bold">Not yet — {promo.to} stays locked for now.</p>
				<p class="text-sm opacity-80">{promo.rationale}</p>
			</div>
			<button class="btn btn-ghost btn-sm" onclick={clearPromotionNotice}>OK</button>
		{/if}
	</div>
{/if}

{#if !lang}
	<div class="alert alert-info">
		<HugeiconsIcon icon={SproutIcon} size={20} /><span
			><a class="link" href={resolve('/onboarding')}>Add a language</a> to start reviewing.</span
		>
	</div>
{:else if cards.length === 0}
	<div class="hero rounded-3xl bg-base-100 shadow-sm">
		<div class="hero-content py-12 text-center">
			<div class="max-w-md">
				<div class="mb-4 flex justify-center text-success">
					<HugeiconsIcon icon={PartyIcon} size={64} />
				</div>
				<h2 class="text-2xl font-bold">All clear!</h2>
				<p class="py-3 opacity-70">
					Session: {sessionCorrect}/{sessionDone} recalled. Come back when cards are due — spaced repetition
					does the rest.
				</p>
				<div class="flex justify-center gap-2">
					<a href={resolve('/decks')} class="btn btn-primary">Generate more cards</a>
					<a href={resolve('/stories')} class="btn btn-outline">Read a story</a>
					{#if deckFilter}<button class="btn btn-ghost" onclick={resetSession}>Recheck</button>{/if}
				</div>
			</div>
		</div>
	</div>
{:else if card}
	<progress class="progress mb-4 w-full progress-primary" value={index} max={cards.length}
	></progress>
	<p class="mb-2 text-sm opacity-60">
		Card {index + 1} of {cards.length} ·
		<span class="inline-flex items-center gap-1">
			<HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} class="text-success" />
			{sessionCorrect}</span
		>{#if sessionRetries > 0}
			· <span class="inline-flex items-center gap-1">
				<HugeiconsIcon icon={ReloadIcon} size={12} />
				{sessionRetries}
				{sessionRetries === 1 ? 'retry' : 'retries'}</span
			>{/if}
	</p>

	<div bind:this={cardEl} class="card bg-base-100 shadow-lg">
		<div class="card-body">
			<p class="text-xl leading-loose">
				{parts[0]}
				{#if !revealed}
					<input
						class="input mx-1 inline-block w-44 max-w-full text-center font-bold input-primary"
						placeholder="…"
						bind:value={typed}
						autocomplete="off"
						spellcheck={false}
						disabled={checking}
					/>
				{:else}
					<span class="px-2 font-bold {wasCorrect ? 'text-success' : 'text-error'}"
						>{card.answer}</span
					>
				{/if}
				{parts[1]}
			</p>

			{#if !revealed && card.wordTranslation}
				<p class="flex items-center gap-1 text-sm opacity-70">
					<HugeiconsIcon icon={SwatchBookIcon} size={16} />
					<span>
						The missing word means <span class="font-semibold">“{card.wordTranslation}”</span> —
						type it in {lang?.name ?? 'the target language'}.
					</span>
				</p>
			{/if}

			{#if card.hint && !revealed}
				<div>
					<button class="btn btn-ghost btn-xs" onclick={() => (showHint = !showHint)}>
						<HugeiconsIcon icon={Idea01Icon} size={14} />
						{showHint ? 'Hide hint' : 'Show hint'}
					</button>
					{#if showHint}<p class="mt-1 text-sm opacity-70">{card.hint}</p>{/if}
				</div>
			{/if}

			{#if !revealed && gentle}
				<div class="rounded-xl bg-info/10 p-3">
					<p class="flex items-center gap-1 text-sm opacity-80">
						<HugeiconsIcon icon={Globe02Icon} size={16} /> {card.translation}
					</p>
				</div>
			{/if}

			{#if revealed && wasCorrect}
				<div class="rounded-xl bg-success/10 p-3">
					<p class="flex items-center gap-1 font-semibold text-success">
						<HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
						{acceptedVariant ? 'Accepted — minor variant' : 'Correct'}
					</p>
					<p class="mt-1 text-sm opacity-80">{card.translation}</p>
				</div>
			{/if}

			{#if revealed && !wasCorrect}
				<div class="rounded-xl bg-error/10 p-3">
					<p class="flex items-center gap-1 font-semibold text-error">
						<HugeiconsIcon icon={Cancel01Icon} size={16} /> Not quite — the answer is “{card.answer}”
					</p>
					<p class="mt-1 text-sm opacity-80">
						You typed “{typed.trim()}” · {card.translation}
					</p>
				</div>
			{/if}

			<div class="mt-2 card-actions">
				{#if !revealed}
					<button
						class="btn flex-1 btn-primary"
						disabled={!typed.trim() || checking}
						onclick={check}
					>
						{#if checking}
							<span class="loading loading-sm loading-spinner"></span> AI checking…
						{:else}
							Check ↵
						{/if}
					</button>
				{:else if wasCorrect}
					<div class="grid w-full grid-cols-3 gap-2">
						<button class="btn btn-outline btn-warning" onclick={() => grade('hard')}>
							Hard<span class="hidden text-xs opacity-60 sm:inline">{preview('hard')}</span>
						</button>
						<button class="btn btn-outline btn-success" onclick={() => grade('fine')}>
							Fine<span class="hidden text-xs opacity-60 sm:inline">{preview('fine')}</span>
						</button>
						<button class="btn btn-outline btn-info" onclick={() => grade('easy')}>
							Easy<span class="hidden text-xs opacity-60 sm:inline">{preview('easy')}</span>
						</button>
					</div>
				{:else if canRequeue()}
					<button class="btn flex-1 btn-primary" onclick={requeue}>
						<HugeiconsIcon icon={ReloadIcon} size={18} /> Try again later in this session
					</button>
				{:else}
					<button class="btn flex-1 btn-primary" onclick={skipForNow}>
						Finish for now — still due next time →
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
