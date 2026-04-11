/**
 * SourceSplash API client.
 *
 * All HTTP requests are made in the main process via Electron's `net.fetch`
 * so the renderer never touches external URLs directly (avoids CORS).
 *
 * Rate limit: 100 requests / hour (free tier ceiling).
 * Results are NOT cached here — caching lives in the renderer (useGallery).
 */

import { net } from 'electron';
import type { SourceSplashImage, SourceSplashSearchResult } from '../shared/types';

const API_BASE = 'https://api.sourcesplash.com';

// ---------------------------------------------------------------------------
// In-memory rate-limit tracker
// ---------------------------------------------------------------------------

interface RateLimitState {
	count: number;
	windowStart: number; // ms timestamp of when the current 1-hour window began
}

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

let rateLimitState: RateLimitState = {
	count: 0,
	windowStart: Date.now(),
};

function checkRateLimit(): void {
	const now = Date.now();
	if (now - rateLimitState.windowStart >= RATE_LIMIT_WINDOW_MS) {
		// New window — reset counter
		rateLimitState = { count: 0, windowStart: now };
	}
	if (rateLimitState.count >= RATE_LIMIT_MAX) {
		const resetInMs = RATE_LIMIT_WINDOW_MS - (now - rateLimitState.windowStart);
		const resetInMin = Math.ceil(resetInMs / 60_000);
		throw new Error(`SourceSplash rate limit reached. Resets in ~${resetInMin} minute${resetInMin !== 1 ? 's' : ''}.`);
	}
	rateLimitState.count += 1;
}

/** Returns remaining requests in the current window (informational). */
export function getRateLimitRemaining(): number {
	const now = Date.now();
	if (now - rateLimitState.windowStart >= RATE_LIMIT_WINDOW_MS) {
		return RATE_LIMIT_MAX;
	}
	return Math.max(0, RATE_LIMIT_MAX - rateLimitState.count);
}

// ---------------------------------------------------------------------------
// Response normalization (API returns snake_case, our types use camelCase)
// ---------------------------------------------------------------------------

interface RawSourceSplashImage {
	id: string;
	url: string;
	thumbnail: string;
	width: number;
	height: number;
	author: string;
	author_url: string;
	source: string;
	description: string;
}

function normalizeImage(raw: RawSourceSplashImage): SourceSplashImage {
	return {
		id: raw.id,
		url: raw.url,
		thumbnail: raw.thumbnail,
		width: raw.width,
		height: raw.height,
		author: raw.author,
		authorUrl: raw.author_url,
		source: raw.source,
		description: raw.description ?? '',
	};
}

// ---------------------------------------------------------------------------
// Raw fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(apiKey: string, endpoint: string, params: Record<string, string | number>): Promise<T> {
	checkRateLimit();

	const url = new URL(`${API_BASE}${endpoint}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}

	const response = await net.fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		if (response.status === 429) {
			throw new Error('SourceSplash rate limit exceeded (server-side).');
		}
		throw new Error(`SourceSplash API error: ${response.status} ${response.statusText}`);
	}

	return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search images by query.
 * GET /api/search?q={query}&page={page}
 */
export async function searchImages(apiKey: string, query: string, page = 1): Promise<SourceSplashSearchResult> {
	if (!query.trim()) {
		throw new Error('Search query cannot be empty.');
	}
	const params: Record<string, string | number> = { q: query.trim(), page };
	const raw = await apiFetch<{
		images?: RawSourceSplashImage[];
		results?: RawSourceSplashImage[];
		page?: number;
		has_more?: boolean;
		hasMore?: boolean;
	}>(apiKey, '/api/search', params);

	const rawImages = raw.images ?? raw.results ?? [];
	return {
		images: rawImages.map(normalizeImage),
		page: raw.page ?? page,
		hasMore: raw.has_more ?? raw.hasMore ?? rawImages.length > 0,
	};
}

/**
 * Fetch random images, optionally filtered by query.
 * GET /api/random?q={query}  (called `count` times in parallel)
 *
 * The SourceSplash /api/random endpoint returns a single image per call.
 * We fan out `count` concurrent requests to fill the suggestions grid.
 */
export async function getRandomImages(apiKey: string, query?: string, count = 6): Promise<SourceSplashImage[]> {
	const clampedCount = Math.min(Math.max(1, count), 20);

	const params: Record<string, string | number> = {};
	if (query?.trim()) {
		params.q = query.trim();
	}

	// Fan out parallel requests — each call to /api/random returns one image.
	const promises = Array.from({ length: clampedCount }, () =>
		apiFetch<RawSourceSplashImage>(apiKey, '/api/random', params),
	);

	// Settle all, normalize, and deduplicate by ID (API can return the same image
	// multiple times when the pool is small relative to the requested count).
	const results = await Promise.allSettled(promises);
	const seen = new Set<string>();
	return results
		.filter((r): r is PromiseFulfilledResult<RawSourceSplashImage> => r.status === 'fulfilled')
		.map((r) => normalizeImage(r.value))
		.filter((img) => {
			if (seen.has(img.id)) return false;
			seen.add(img.id);
			return true;
		});
}
