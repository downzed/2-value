import { net } from 'electron';
import type { ExternalImage, ExternalSearchResult } from '../shared/types';

const RATE_LIMITS = {
	pexels: { max: 200, windowMs: 60 * 60 * 1000 },
};

export interface ImageProvider {
	name: string;
	search(query: string, page?: number): Promise<ExternalSearchResult>;
	getRandom(query?: string, count?: number): Promise<ExternalImage[]>;
}

interface RateLimitState {
	count: number;
	windowStart: number;
}

function createRateLimiter(maxRequests: number, windowMs: number) {
	let state: RateLimitState = { count: 0, windowStart: Date.now() };

	return {
		check: () => {
			const now = Date.now();
			if (now - state.windowStart >= windowMs) {
				state = { count: 0, windowStart: now };
			}
			if (state.count >= maxRequests) {
				const resetInMs = windowMs - (now - state.windowStart);
				const resetInMin = Math.ceil(resetInMs / 60_000);
				throw new Error(`Rate limit reached. Resets in ~${resetInMin} minute${resetInMin !== 1 ? 's' : ''}.`);
			}
			state.count += 1;
		},
		remaining: () => {
			const now = Date.now();
			if (now - state.windowStart >= windowMs) {
				return maxRequests;
			}
			return Math.max(0, maxRequests - state.count);
		},
	};
}

export function getRateLimiter(provider: string) {
	const config = RATE_LIMITS[provider as keyof typeof RATE_LIMITS];
	if (!config) {
		throw new Error(`Unknown provider: ${provider}`);
	}
	return createRateLimiter(config.max, config.windowMs);
}

export async function apiFetch(
	apiKey: string,
	endpoint: string,
	params: Record<string, string | number>,
): Promise<Response> {
	const url = new URL(`https://api.pexels.com${endpoint}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}

	const response = await net.fetch(url.toString(), {
		headers: {
			Authorization: apiKey,
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		if (response.status === 429) {
			throw new Error('Rate limit exceeded (server-side).');
		}
		throw new Error(`API error: ${response.status} ${response.statusText}`);
	}

	return response;
}
