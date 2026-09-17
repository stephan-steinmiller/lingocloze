// lingocloze CORS proxy as a Supabase Edge Function.
//
// Why: static hosts (surge.sh) run no server code, and the OpenCode Go/Zen
// gateway sends no CORS headers, so browsers refuse direct calls. This
// function forwards the exact { url, headers, body } protocol our SvelteKit
// /api/zen route speaks, adds CORS + the required x-opencode-session header,
// and only ever talks to ALLOWED_HOSTS (SSRF guard).
//
// Deploy: supabase functions deploy zen-proxy --project-ref <ref> --no-verify-jwt
// (--no-verify-jwt keeps it callable from the browser with no auth JWT; your
// Go key still travels per-request and nothing is stored or logged.)
// Use: paste https://<ref>.supabase.co/functions/v1/zen-proxy into the app's
// Settings → provider → "CORS proxy URL".

const ALLOWED_HOSTS = new Set(['opencode.ai']);

const CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'POST, OPTIONS',
	'access-control-allow-headers': 'content-type',
	'access-control-max-age': '86400'
};

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', ...CORS_HEADERS }
	});
}

Deno.serve(async (req: Request): Promise<Response> => {
	if (req.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}
	if (req.method !== 'POST') {
		return json({ error: 'Method not allowed.' }, 405);
	}

	let payload: { url?: unknown; headers?: Record<string, unknown>; body?: unknown };
	try {
		payload = (await req.json()) as typeof payload;
	} catch {
		return json({ error: 'Expected a JSON body.' }, 400);
	}

	let target: URL;
	try {
		target = new URL(String(payload.url));
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
		const value = incoming[key];
		if (value != null) outgoing.set(key, String(value));
	}
	if (target.hostname === 'opencode.ai' && !outgoing.has('x-opencode-session')) {
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
			502
		);
	}

	const text = await upstream.text();
	try {
		return json(JSON.parse(text) as unknown, upstream.status);
	} catch {
		return json({ error: 'Upstream returned non-JSON.', text: text.slice(0, 500) }, 502);
	}
});
