// Auth callback is a static shell; the code exchange happens client-side
// in +page.svelte so it also works on static hosts (surge.sh) where there
// is no server route, and inside Capacitor shells.
export const prerender = true;
