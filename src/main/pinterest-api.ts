/**
 * Pinterest API v5 wrapper.
 *
 * All requests go through the Electron main process — the renderer never
 * communicates directly with Pinterest.  This module uses the native `fetch`
 * available in Node 18+ (Electron 28+).
 */

import type {
	PinterestBoard,
	PinterestPaginatedResponse,
	PinterestPin,
	SavePinArgs,
	SavePinResult,
} from '../shared/pinterest-types';
import { getValidAccessToken } from './pinterest-auth';

// ─── Constants ─────────────────────────────────────────────────────────────

export const PINTEREST_API = {
	AUTH_URL: 'https://www.pinterest.com/oauth/',
	TOKEN_URL: 'https://api.pinterest.com/v5/oauth/token',
	BASE_URL: 'https://api.pinterest.com/v5',
	SCOPES: ['boards:read', 'pins:read', 'pins:write'],
} as const;

// ─── Request helper ─────────────────────────────────────────────────────────

async function request<T>(method: string, endpoint: string, body?: Record<string, unknown>): Promise<T> {
	const accessToken = await getValidAccessToken();
	if (!accessToken) {
		throw new Error('Not authenticated with Pinterest');
	}

	const url = `${PINTEREST_API.BASE_URL}${endpoint}`;
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		'Content-Type': 'application/json',
	};

	const response = await fetch(url, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Pinterest API error ${response.status}: ${text}`);
	}

	return response.json() as Promise<T>;
}

// ─── Boards ─────────────────────────────────────────────────────────────────

/**
 * Fetch all boards belonging to the authenticated user.
 * Follows pagination cursors automatically and returns a flat array.
 */
export async function fetchBoards(): Promise<PinterestBoard[]> {
	const boards: PinterestBoard[] = [];
	let bookmark: string | undefined;

	do {
		const params = new URLSearchParams({ page_size: '25' });
		if (bookmark) params.set('bookmark', bookmark);

		const page = await request<PinterestPaginatedResponse<PinterestBoard>>('GET', `/boards?${params.toString()}`);
		boards.push(...page.items);
		bookmark = page.bookmark;
	} while (bookmark);

	return boards;
}

/**
 * Fetch a single board by ID.
 */
export async function fetchBoard(boardId: string): Promise<PinterestBoard> {
	return request<PinterestBoard>('GET', `/boards/${encodeURIComponent(boardId)}`);
}

// ─── Pins ────────────────────────────────────────────────────────────────────

/**
 * Save an edited image as a new pin on the specified board.
 *
 * The `imageDataUrl` is a base64 data URL produced by the renderer canvas.
 * Pinterest's v5 API accepts a `media_source` with `source_type: "image_base64"`.
 */
export async function savePin(args: SavePinArgs): Promise<SavePinResult> {
	const { boardId, imageDataUrl, title, description, link } = args;

	// Strip the "data:image/png;base64," prefix
	const base64Match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
	if (!base64Match) {
		return { ok: false, error: 'Invalid image data URL format' };
	}
	const [, contentType, base64Data] = base64Match;

	const body: Record<string, unknown> = {
		board_id: boardId,
		media_source: {
			source_type: 'image_base64',
			content_type: contentType,
			data: base64Data,
		},
	};
	if (title) body.title = title;
	if (description) body.description = description;
	if (link) body.link = link;

	try {
		const pin = await request<PinterestPin>('POST', '/pins', body);
		return { ok: true, pin };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'Unknown error saving pin' };
	}
}

/**
 * Fetch pins for a board (first page only).
 */
export async function fetchBoardPins(
	boardId: string,
	bookmark?: string,
): Promise<PinterestPaginatedResponse<PinterestPin>> {
	const params = new URLSearchParams({ page_size: '25' });
	if (bookmark) params.set('bookmark', bookmark);
	return request<PinterestPaginatedResponse<PinterestPin>>(
		'GET',
		`/boards/${encodeURIComponent(boardId)}/pins?${params.toString()}`,
	);
}
