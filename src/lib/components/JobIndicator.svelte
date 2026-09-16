<script lang="ts">
	import { getJobs, runningCount } from '$lib/stores/jobs.svelte';

	let n = $derived(runningCount());
	let jobs = $derived(getJobs());
	let target = $derived(
		jobs.some((j) => j.kind === 'story' && j.status === 'running') ? '/stories' : '/decks'
	);
</script>

{#if n > 0}
	<a href={target} class="badge gap-1 badge-primary" title="Generation running — click to check">
		<span class="loading loading-spinner loading-xs"></span>
		{n} generating…
	</a>
{/if}
