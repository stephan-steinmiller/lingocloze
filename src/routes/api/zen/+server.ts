import { json, type RequestHandler } from '@sveltejs/kit';

/**
 * POST /api/zen — tiny server-side forwarder for OpenAI-compatible chat APIs.
 *
 * Why this exists: gateways like OpenCode Zen send no CORS headers, so browsers
 * refuse direct calls ("Failed to fetch"). Server-to-server has no CORS, and it
 * also lets us set the browser-like User-Agent some gateways demand and inject
 * the `x-opencode-session` header Zen requires.
 *
 * BYOK is preserved: the caller's key is only forwarded, never stored. The
 * server keeps no secrets.
 *
 * Body: { url: string, headers?: Record<string, string>, body?: unknown }
 * Responds with the upstream status code and JSON body.
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
	let payload: { url?: unknown; headers?: unknown; body?: unknown };
	try {
		payload = (await request.json()) as typeof payload;
	} catch {
		return json({ error: 'Expected a JSON body.' }, { status: 400 });
	}
	if (typeof payload.url !== 'string') {
		return json({ error: 'Missing "url".' }, { status: 400 });
	}

	let target: URL;
	try {
		target = new URL(payload.url);
	} catch {
		return json({ error: 'Invalid "url".' }, { status: 400 });
	}

	const hostname = target.hostname.toLowerCase();
	const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	// SSRF guardrails: https everywhere, http only for loopback, never the
	// cloud metadata endpoint, no credentials embedded in the URL.
	if (target.username || target.password) {
		return json({ error: 'URLs with credentials are not allowed.' }, { status: 400 });
	}
	if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
		return json({ error: 'URL host is not allowed.' }, { status: 400 });
	}
	if (target.protocol === 'http:' && !isLocalhost) {
		return json({ error: 'Only https:// URLs are allowed (http only for localhost).' }, { status: 400 });
	}
	if (target.protocol !== 'http:' && target.protocol !== 'https:') {
		return json({ error: 'Only http(s):// URLs are allowed.' }, { status: 400 });
	}

	const incoming = (payload.headers ?? {}) as Record<string, string>;
	const outgoing = new Headers();
	outgoing.set('content-type', 'application/json');
	// Some gateways (Cloudflare-fronted) reject non-browser user agents.
	outgoing.set(
		'user-agent',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
	);
	for (const [key, value] of Object.entries(incoming)) {
		const k = key.toLowerCase();
		if (
			k === 'authorization' ||
			k === 'x-api-key' ||
			k === 'anthropic-version' ||
			k === 'x-opencode-session'
		) {
			outgoing.set(k, String(value));
		}
	}
	// Zen's Go gateway requires a session id for routing; mint one per request
	// when the caller didn't supply it.
	if (hostname === 'opencode.ai' && !outgoing.has('x-opencode-session')) {
		outgoing.set('x-opencode-session', crypto.randomUUID());
	}

	let upstream: Response;
	try {
		upstream = await fetch(target.toString(), {
			method: 'POST',
			headers: outgoing,
			body: payload.body === undefined ? undefined : JSON.stringify(payload.body)
		});
	} catch (err) {
		return json(
			{ error: `Upstream unreachable: ${err instanceof Error ? err.message : String(err)}` },
			{ status: 502 }
		);
	}

	const text = await upstream.text();
	try {
		return json(JSON.parse(text) as unknown, { status: upstream.status });
	} catch {
		return json({ error: 'Upstream returned non-JSON.', text: text.slice(0, 500) }, { status: 502 });
	}
};
