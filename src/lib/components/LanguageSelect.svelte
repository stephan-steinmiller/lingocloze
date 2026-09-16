<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getLanguages } from '$lib/db/database';
	import { getActiveLanguageId, getDbRevision, setActiveLanguageId, touchDb } from '$lib/stores/app.svelte';
	import { getUser } from '$lib/stores/auth.svelte';

	// Re-read on every db touch AND on account switch (stores are per-user).
	let rev = $derived(getDbRevision());
	let uid = $derived(getUser()?.id ?? null);
	let languages = $derived.by(() => {
		void rev;
		void uid;
		return getLanguages();
	});
	let activeId = $derived.by(() => {
		void rev;
		void uid;
		return getActiveLanguageId();
	});

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	async function pick(e: Event): Promise<void> {
		const id = (e.target as HTMLSelectElement).value;
		if (id === '__add') {
			await goto(resolve('/onboarding'));
			return;
		}
		setActiveLanguageId(id);
		touchDb();
	}
</script>

{#if languages.length === 0}
	<a href={resolve('/onboarding')} class="btn btn-primary {compact ? 'btn-sm' : ''}">
		+ Add your first language
	</a>
{:else}
	<select
		class="select max-w-full {compact ? 'select-sm' : ''}"
		value={activeId ?? ''}
		onchange={pick}
		aria-label="Active language"
	>
		{#each languages as l (l.id)}
			<option value={l.id}>{l.name} · {l.level}</option>
		{/each}
		<option value="__add">+ Add language…</option>
	</select>
{/if}
