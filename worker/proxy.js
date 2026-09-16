// lingocloze CORS proxy — deploy to Cloudflare Workers (free tier).
//
// Why: static hosts (surge.sh) run no server code, and the OpenCode Go/Zen
// gateway sends no CORS headers, so browsers refuse direct calls. This
// worker forwards the exact { url, headers, body } protocol our SvelteKit
// /api/zen route speaks, adds CORS + the required x-opencode-session header,
// and only ever talks to the hosts in ALLOWED_HOSTS (SSRF guard).
//
// Deploy (one time, ~2 minutes):
//   1. npx wrangler login
//   2. npx wrangler deploy   (from the worker/ directory)
//   3. Paste the https://<name>.workers.dev URL into the app:
//      Settings → provider → "CORS proxy URL".
//
// Your API key travels browser → worker → opencode.ai only. The worker
// stores nothing and logs nothing.

const ALLOWED_HOSTS = new Set(['opencode.ai']);

const CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'POST, OPTIONS',
	'access-control-allow-headers': 'content-type',
	'access-control-max-age': '86400'
};

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', ...CORS_HEADERS }
	});
}

export default {
	async fetch(request) {
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}
		if (request.method !== 'POST') {
			return json({ error: 'Method not allowed.' }, 405);
		}

		let payload;
		try {
			payload = await request.json();
		} catch {
			return json({ error: 'Expected a JSON body.' }, 400);
		}

		let target;
		try {
			target = new URL(payload.url);
		} catch {
			return json({ error: 'Invalid "url".' }, 400);
		}
		if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
			return json({ error: 'URL host is not allowed.' }, 400);
		}

		const outgoing = new Headers();
		outgoing.set('content-type', 'application/json');
		// Some gateways reject non-browser user agents.
		outgoing.set(
			'user-agent',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
		);
		const incoming = payload.headers ?? {};
		for (const key of ['authorization', 'x-api-key', 'anthropic-version', 'x-opencode-session']) {
			if (incoming[key] != null) outgoing.set(key, String(incoming[key]));
		}
		if (target.hostname === 'opencode.ai' && !outgoing.has('x-opencode-session')) {
			outgoing.set('x-opencode-session', crypto.randomUUID());
		}

		let upstream;
		try {
			upstream = await fetch(target.toString(), {
				method: 'POST',
				headers: outgoing,
				body: payload.body === undefined ? undefined : JSON.stringify(payload.body)
			});
		} catch (err) {
			return json({ error: `Upstream unreachable: ${err?.message ?? err}` }, 502);
		}

		const text = await upstream.text();
		try {
			return json(JSON.parse(text), upstream.status);
		} catch {
			return json({ error: 'Upstream returned non-JSON.', text: text.slice(0, 500) }, 502);
		}
	}
};
