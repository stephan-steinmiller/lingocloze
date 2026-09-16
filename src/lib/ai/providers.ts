import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'compatible' | 'opencode-go';

export interface BYOKSettings {
	provider: AIProvider;
	model: string;
	apiKey: string;
	/** Only for "compatible" (OpenRouter, Ollama, Together, custom gateway…) */
	baseURL: string;
}

const SETTINGS_KEY = 'ling_byok_v1';

/** Base URL of the OpenCode Go subscription gateway (billed via subscription). */
export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1';

type GoFlavor = 'responses' | 'chat' | 'messages';

/** Which Go endpoint each model lives on (see opencode.ai/docs/go#endpoints). */
const GO_FLAVORS: Record<string, GoFlavor> = {
	'grok-4.6': 'responses',
	'gpt-5.6-luna': 'responses',
	'muse-spark-1.3-contributor': 'responses',
	'muse-spark-1.2-contributor': 'responses',
	'minimax-m3': 'messages',
	'minimax-m2.7': 'messages',
	'minimax-m2.5': 'messages',
	'qwen3.8-max': 'messages',
	'qwen3.8-flash': 'messages',
	'qwen3.7-max': 'messages',
	'qwen3.7-plus': 'messages',
	'qwen3.6-plus': 'messages'
};

const GO_MODEL_IDS = [
	'muse-spark-1.3-contributor',
	'muse-spark-1.2-contributor',
	'gpt-5.6-luna',
	'grok-4.6',
	'glm-5.3-flash',
	'glm-5.3',
	'glm-5.2',
	'glm-5.1',
	'kimi-k3',
	'kimi-k2.7-code',
	'kimi-k2.6',
	'longcat-2.0',
	'deepseek-v4.1-flash',
	'deepseek-v4-pro',
	'deepseek-v4-flash',
	'deepseek-v4-flash-vision-exp',
	'mimo-v2.5',
	'mimo-v2.5-pro',
	'minimax-m3',
	'minimax-m2.7',
	'minimax-m2.5',
	'qwen3.8-max',
	'qwen3.8-flash',
	'qwen3.7-max',
	'qwen3.7-plus',
	'qwen3.6-plus',
	'hy4-preview',
	'hy3'
];

export function goFlavorFor(model: string): GoFlavor {
	return GO_FLAVORS[model] ?? 'chat';
}

export const PROVIDERS: Array<{
	id: AIProvider;
	name: string;
	description: string;
	placeholder: string;
	defaultModel: string;
	models: string[];
	keyUrl: string;
}> = [
	{
		id: 'openai',
		name: 'OpenAI',
		description: 'GPT-4o mini and friends. Good multilingual quality.',
		placeholder: 'sk-…',
		defaultModel: 'gpt-4o-mini',
		models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
		keyUrl: 'https://platform.openai.com/api-keys'
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		description: 'Claude Haiku/Sonnet. Strong at explanations.',
		placeholder: 'sk-ant-…',
		defaultModel: 'claude-haiku-4-5',
		models: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-3-5-haiku-latest'],
		keyUrl: 'https://console.anthropic.com/settings/keys'
	},
	{
		id: 'google',
		name: 'Google',
		description: 'Gemini Flash. Generous free tier.',
		placeholder: 'AIza…',
		defaultModel: 'gemini-2.0-flash',
		models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
		keyUrl: 'https://aistudio.google.com/apikey'
	},
	{
		id: 'compatible',
		name: 'OpenAI-compatible',
		description: 'OpenRouter, Ollama, Together, LM Studio, custom gateway…',
		placeholder: 'your key (or "ollama" for local)',
		defaultModel: 'openai/gpt-4o-mini',
		models: [
			'openai/gpt-4o-mini',
			'anthropic/claude-3.5-haiku',
			'meta-llama/llama-3.3-70b-instruct'
		],
		keyUrl: 'https://openrouter.ai/keys'
	},
	{
		id: 'opencode-go',
		name: 'OpenCode Go',
		description: '$10/mo subscription gateway. Key stays in this browser.',
		placeholder: 'paste your Go API key',
		defaultModel: 'muse-spark-1.3-contributor',
		models: GO_MODEL_IDS,
		keyUrl: 'https://opencode.ai/auth'
	}
];

export function defaultSettings(): BYOKSettings {
	return { provider: 'openai', model: 'gpt-4o-mini', apiKey: '', baseURL: '' };
}

export function loadSettings(): BYOKSettings {
	try {
		if (typeof localStorage === 'undefined') return defaultSettings();
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) return defaultSettings();
		return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<BYOKSettings>) };
	} catch {
		return defaultSettings();
	}
}

export function saveSettings(s: BYOKSettings): void {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
	} catch {
		/* private mode etc. — keys stay in memory only */
	}
}

export function hasApiKey(s: BYOKSettings): boolean {
	return s.apiKey.trim().length > 0 || (s.provider === 'compatible' && s.baseURL.trim().length > 0);
}

/**
 * fetch wrapper that routes OpenAI-compatible calls through our same-origin
 * /api/zen proxy (see src/routes/api/zen/+server.ts). Fixes gateways without
 * CORS headers and injects required extras like x-opencode-session.
 */
async function proxyFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
	let url: string;
	let headers: Record<string, string> = {};
	let body: unknown;
	if (typeof input === 'string' || input instanceof URL) {
		url = String(input);
		if (init?.headers instanceof Headers) {
			headers = Object.fromEntries(init.headers.entries());
		} else if (init?.headers) {
			headers = Object.fromEntries(new Headers(init.headers).entries());
		}
		if (typeof init?.body === 'string') {
			try {
				body = JSON.parse(init.body) as unknown;
			} catch {
				body = init.body;
			}
		} else {
			body = init?.body;
		}
	} else {
		url = input.url;
		headers = Object.fromEntries(input.headers.entries());
		body = await input.text();
		try {
			body = JSON.parse(body as string) as unknown;
		} catch {
			/* keep as text */
		}
	}
	return fetch('/api/zen', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ url, headers, body })
	});
}

/**
 * Build a LanguageModel from the user's own key. Client-side only — keys never
 * leave the browser except to the chosen provider's API (directly, or via our
 * header-stripping same-origin proxy for CORS-less gateways — never stored).
 */
export function getLanguageModel(s: BYOKSettings): LanguageModel {
	const apiKey = s.apiKey.trim() || undefined;
	switch (s.provider) {
		case 'anthropic': {
			const anthropic = createAnthropic({ apiKey });
			return anthropic(s.model || 'claude-haiku-4-5');
		}
		case 'google': {
			const google = createGoogleGenerativeAI({ apiKey });
			return google(s.model || 'gemini-2.0-flash');
		}
		case 'compatible': {
			const compat = createOpenAICompatible({
				name: 'custom',
				apiKey: s.apiKey.trim() || 'no-key',
				baseURL: s.baseURL.trim() || 'http://localhost:11434/v1',
				fetch: proxyFetch
			});
			return compat(s.model);
		}
		case 'opencode-go': {
			// Subscription gateway: each model lives on a specific endpoint
			// flavor (responses / chat / messages). Routed via the proxy so
			// CORS-less Zen/Go endpoints and the x-opencode-session header work.
			const model = s.model || 'muse-spark-1.3-contributor';
			const flavor = goFlavorFor(model);
			if (flavor === 'responses') {
				const go = createOpenAI({
					apiKey: s.apiKey.trim() || undefined,
					baseURL: OPENCODE_GO_BASE_URL,
					fetch: proxyFetch
				});
				return go.responses(model);
			}
			if (flavor === 'messages') {
				const claude = createAnthropic({
					apiKey: s.apiKey.trim() || undefined,
					baseURL: OPENCODE_GO_BASE_URL,
					fetch: proxyFetch
				});
				return claude(model);
			}
			const go = createOpenAI({
				apiKey: s.apiKey.trim() || undefined,
				baseURL: OPENCODE_GO_BASE_URL,
				fetch: proxyFetch
			});
			return go.chat(model);
		}
		case 'openai':
		default: {
			const openai = createOpenAI({ apiKey });
			return openai(s.model || 'gpt-4o-mini');
		}
	}
}

export function providerName(id: AIProvider): string {
	return PROVIDERS.find((p) => p.id === id)?.name ?? id;
}
