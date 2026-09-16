<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Alert02Icon, Cards01Icon } from '@hugeicons/core-free-icons';
	import { getCards, getDeck } from '$lib/db/database';
	import { splitCloze } from '$lib/utils/text';

	let deckId = $derived(page.params.id);
	let deck = $derived(deckId ? getDeck(deckId) : undefined);
	let cards = $derived(deckId ? getCards(deckId) : []);
</script>

<a href={resolve('/decks')} class="btn mb-3 btn-ghost btn-sm">← All decks</a>

{#if !deck}
	<div class="alert alert-error">
		<HugeiconsIcon icon={Alert02Icon} size={20} /><span>Deck not found.</span>
	</div>
{:else}
	<h1 class="text-2xl font-bold">{deck.title}</h1>
	<p class="mb-4 opacity-60">{deck.topic} · {deck.level} · {cards.length} cards</p>

	<a href={resolve(`/review?deck=${deck.id}`)} class="btn mb-4 btn-primary">
		<HugeiconsIcon icon={Cards01Icon} size={20} /> Review this deck
	</a>

	<div class="grid gap-2">
		{#each cards as c (c.id)}
			{@const [before, after] = splitCloze(c.sentence)}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body px-4 py-3">
					<p>{before}<span class="cloze-blank" role="img" aria-label="blank"></span>{after}</p>
					<p class="text-sm"><span class="badge badge-sm badge-success">{c.answer}</span></p>
					<p class="text-sm opacity-60">{c.translation}</p>
				</div>
			</div>
		{/each}
	</div>
{/if}
