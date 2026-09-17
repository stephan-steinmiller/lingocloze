import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.lingocloze.app',
	appName: 'lingocloze',
	// SvelteKit static output (adapter-static). Rebuild + `cap sync` to refresh.
	webDir: 'build',
	server: {
		// Bundled by default; uncomment for live-reload dev against a LAN URL:
		// url: 'http://192.168.1.10:5201',
		// cleartext: true
	},
	plugins: {
		// Capgo OTA updates. Fill appId after `npx @capgo/cli init`
		// (dashboard → your app → copy ID). autoUpdate pulls new bundles.
		CapacitorUpdater: {
			appId: 'YOUR_CAPGO_APP_ID',
			autoUpdate: true
		}
	}
};

export default config;
