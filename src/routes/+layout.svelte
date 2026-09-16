<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowLeftDoubleIcon,
		ArrowRightDoubleIcon,
		BookOpen01Icon,
		Cards01Icon,
		Home01Icon,
		Layers01Icon,
		Settings03Icon,
		StarIcon,
		SwatchBookIcon
	} from '@hugeicons/core-free-icons';
	import favicon from '$lib/assets/favicon.svg';
	import JobIndicator from '$lib/components/JobIndicator.svelte';
	import { initNativeDatabase } from '$lib/db/capacitor';
	import {
		getActiveLanguageId,
		isSidebarCollapsed,
		setActiveLanguageId,
		toggleSidebar
	} from '$lib/stores/app.svelte';
	import { getLanguages } from '$lib/db/database';
	import './layout.css';

	let { children } = $props();

	let languages = $state(getLanguages());
	let dbReady = $state(false);
	let collapsed = $derived(isSidebarCollapsed());

	onMount(async () => {
		// Native SQLite on Capacitor shells; instant no-op on web where the
		// localStorage document store is used.
		await initNativeDatabase();
		dbReady = true;
		languages = getLanguages();
		// Auto-select the first language if none is active.
		if (!getActiveLanguageId() && languages.length > 0) {
			setActiveLanguageId(languages[0].id);
		}
	});

	const nav = [
		{ href: '/', label: 'Home', icon: Home01Icon },
		{ href: '/review', label: 'Review', icon: Cards01Icon },
		{ href: '/decks', label: 'Decks', icon: Layers01Icon },
		{ href: '/stories', label: 'Stories', icon: BookOpen01Icon },
		{ href: '/words', label: 'Words', icon: SwatchBookIcon },
		{ href: '/settings', label: 'Settings', icon: Settings03Icon }
	];
	// Sidebar order: main destinations up top, collapse toggle below Words,
	// Settings pinned to the bottom. (The mobile dock keeps all six in order.)
	const mainNav = nav.filter((i) => i.href !== '/settings');
	const settingsNav = nav.find((i) => i.href === '/settings');

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>lingocloze</title>
</svelte:head>

<div class="drawer min-h-screen bg-base-200 lg:drawer-open">
	<input id="nav-drawer" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col">
		<!-- Top bar (mobile): brand + job status. No drawer toggle — mobile
			navigates via the bottom dock, the sidebar is desktop-only. -->
		<div class="navbar sticky top-0 z-30 bg-base-100 shadow-sm lg:hidden">
			<div class="flex-1">
				<a href={resolve('/')} class="btn btn-ghost text-xl"
					>lingocloze{' '}<span class="text-primary">✦</span></a
				>
			</div>
			<div class="flex-none pr-2">
				<JobIndicator />
			</div>
		</div>

		<main class="mx-auto w-full max-w-4xl flex-1 p-4 pb-24 lg:pb-10">
			{#if dbReady}
				{@render children()}
			{:else}
				<div class="flex flex-col items-center gap-3 pt-24">
					<span class="loading loading-lg loading-spinner text-primary"></span>
					<p class="text-sm opacity-60">Opening your local database…</p>
				</div>
			{/if}
		</main>

		<!-- Bottom dock (mobile): all six destinations, no drawer needed. -->
		<nav class="dock lg:hidden">
			{#each nav as item (item.href)}
				<a href={item.href} class:dock-active={isActive(item.href)} title={item.label}>
					<HugeiconsIcon icon={item.icon} size={22} />
					<span class="dock-label">{item.label}</span>
				</a>
			{/each}
		</nav>
	</div>

	<!-- Sidebar (desktop) -->
	<div class="drawer-side">
		<label for="nav-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<aside
			class="menu min-h-full gap-1 bg-base-100 p-4 transition-[width] duration-300 ease-in-out {collapsed
				? 'w-20 lg:w-20 rail-collapsed'
				: 'w-48'}"
		>
			<li>
				<a
					href={resolve('/')}
					title="lingocloze home"
					class="side-item text-xl font-bold {collapsed ? 'rail-circle' : ''}"
				>
					<span class="lg:hidden">lingocloze{' '}<span class="text-primary">✦</span></span>
					{#if collapsed}
						<span class="hidden lg:inline-flex" title="lingocloze">
							<HugeiconsIcon icon={StarIcon} size={22} class="text-primary" />
						</span>
					{:else}
						<span
							class="hidden overflow-hidden whitespace-nowrap transition-all duration-300 lg:inline-block lg:max-w-40 lg:opacity-100"
							>lingocloze{' '}<span class="text-primary">✦</span></span
						>
					{/if}
				</a>
			</li>
			{#each mainNav as item (item.href)}
				<li title={collapsed ? item.label : undefined}>
					<a
						href={item.href}
						class="side-item text-base {collapsed ? 'rail-circle' : ''}"
						class:menu-active={isActive(item.href)}
					>
						<HugeiconsIcon icon={item.icon} size={22} />
						<span class={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
					</a>
				</li>
			{/each}
			<li class="hidden lg:block" title={collapsed ? 'Expand sidebar' : 'Collapse to icons'}>
				<a
					href="#sidebar-toggle"
					onclick={(e) => {
						e.preventDefault();
						toggleSidebar();
					}}
					class="side-item text-base {collapsed ? 'rail-circle' : ''}"
					aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons'}
				>
					{#key collapsed}
						<HugeiconsIcon
							icon={collapsed ? ArrowRightDoubleIcon : ArrowLeftDoubleIcon}
							size={22}
						/>
					{/key}
					<span class={collapsed ? 'lg:hidden' : ''}>
						{collapsed ? 'Expand' : 'Collapse'}
					</span>
				</a>
			</li>
			{#if settingsNav}
				<li class="mt-auto" title={collapsed ? settingsNav.label : undefined}>
					<a
						href={settingsNav.href}
						class="side-item text-base {collapsed ? 'rail-circle' : ''}"
						class:menu-active={isActive(settingsNav.href)}
					>
						<HugeiconsIcon icon={settingsNav.icon} size={22} />
						<span class={collapsed ? 'lg:hidden' : ''}>{settingsNav.label}</span>
					</a>
				</li>
			{/if}
			<div class="px-2 pt-2">
				<JobIndicator />
			</div>
		</aside>
	</div>
</div>
