// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/** Short git hash baked at build/dev start — shown in Settings to verify versions. */
	const __BUILD_ID__: string;
}

export {};
