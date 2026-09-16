<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getLanguages } from '$lib/db/database';
	import { getActiveLanguageId, setActiveLanguageId } from '$lib/stores/app.svelte';

	let languages = $state(getLanguages());
	let activeId = $state(getActiveLanguageId());

	export function refresh(): void {
		languages = getLanguages();
		activeId = getActiveLanguageId();
	}

	async function pick(e: Event): Promise<void> {
		const id = (e.target as HTMLSelectElement).value;
		if (id === '__add') {
			await goto(resolve('/onboarding'));
			return;
		}
		setActiveLanguageId(id);
		activeId = id;
	}
</script>

{#if languages.length === 0}
	<a href={resolve('/onboarding')} class="btn btn-primary btn-lg"> + Add your first language </a>
{:else}
	<select
		class="select select-lg max-w-full"
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
