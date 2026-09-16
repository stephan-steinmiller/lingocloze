<script lang="ts">
	import { onMount } from 'svelte';
	import { THEMES, getTheme, setTheme } from '$lib/ui/themes';

	let current = $state(getTheme());

	onMount(() => {
		// Re-apply on mount (covers HMR remounts and back/forward cache).
		current = setTheme(getTheme());
	});

	function pick(e: Event): void {
		current = setTheme((e.target as HTMLSelectElement).value);
	}
</script>

<label class="flex items-center gap-2">
	<select
		class="select max-w-full flex-1"
		value={current}
		onchange={pick}
		aria-label="Color theme"
	>
		{#each THEMES as t (t)}
			<option value={t}>{t}</option>
		{/each}
	</select>
</label>
