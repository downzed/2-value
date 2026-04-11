/**
 * Pinterest OAuth 2.0 authentication flow and secure token management.
 *
 * Uses Electron's safeStorage API to encrypt tokens at rest and the
 * system browser + a custom protocol / redirect URI for the OAuth callback.
 *
 * Environment variables required:
 *   PINTEREST_CLIENT_ID     – your app's Client ID from developers.pinterest.com
 *   PINTEREST_CLIENT_SECRET – your app's Client Secret (never sent to renderer)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage, shell } from 'electron';
import type { PinterestAuthResult, PinterestTokenData } from '../shared/pinterest-types';

// Re-export so callers don't need a separate import
export const PINTEREST_OAUTH = {
	AUTH_URL: 'https://www.pinterest.com/oauth/',
	TOKEN_URL: 'https://api.pinterest.com/v5/oauth/token',
	SCOPES: ['boards:read', 'pins:read', 'pins:write'],
} as const;

// ─── Constants ───────────────────────────────────────────────────────────────

const TOKEN_FILE = 'pinterest-token.enc';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── In-memory state ─────────────────────────────────────────────────────────

let tokenCache: PinterestTokenData | null = null;
let pendingState: { value: string; expiresAt: number } | null = null;

// ─── Storage helpers ─────────────────────────────────────────────────────────

function tokenFilePath(): string {
	return path.join(app.getPath('userData'), TOKEN_FILE);
}

function persistToken(data: PinterestTokenData): void {
	if (!safeStorage.isEncryptionAvailable()) {
		throw new Error('safeStorage encryption is not available on this system');
	}
	const json = JSON.stringify(data);
	const encrypted = safeStorage.encryptString(json);
	fs.writeFileSync(tokenFilePath(), encrypted);
	tokenCache = data;
}

function loadPersistedToken(): PinterestTokenData | null {
	if (tokenCache) return tokenCache;
	const filePath = tokenFilePath();
	if (!fs.existsSync(filePath)) return null;
	try {
		const encrypted = fs.readFileSync(filePath);
		const json = safeStorage.decryptString(encrypted);
		tokenCache = JSON.parse(json) as PinterestTokenData;
		return tokenCache;
	} catch {
		// Corrupted or unreadable — treat as unauthenticated
		return null;
	}
}

function clearPersistedToken(): void {
	tokenCache = null;
	try {
		fs.unlinkSync(tokenFilePath());
	} catch {
		// File may not exist
	}
}

// ─── PKCE / state helpers ────────────────────────────────────────────────────

function generateState(): string {
	const value = crypto.randomBytes(24).toString('hex');
	pendingState = { value, expiresAt: Date.now() + STATE_TTL_MS };
	return value;
}

function validateAndConsumeState(state: string): boolean {
	if (!pendingState) return false;
	if (Date.now() > pendingState.expiresAt) {
		pendingState = null;
		return false;
	}
	const valid = crypto.timingSafeEqual(Buffer.from(state), Buffer.from(pendingState.value));
	pendingState = null;
	return valid;
}

// ─── Token exchange ───────────────────────────────────────────────────────────

async function exchangeCodeForToken(code: string, redirectUri: string): Promise<PinterestTokenData> {
	const clientId = process.env.PINTEREST_CLIENT_ID;
	const clientSecret = process.env.PINTEREST_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error('PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET must be set');
	}

	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri,
	});

	const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
	const response = await fetch(PINTEREST_OAUTH.TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${credentials}`,
		},
		body: params.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token exchange failed: ${response.status} ${text}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
		token_type: string;
		scope: string;
	};

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 30 * 24 * 60 * 60 * 1000),
		tokenType: data.token_type,
		scope: data.scope,
	};
}

async function refreshAccessToken(refreshToken: string): Promise<PinterestTokenData> {
	const clientId = process.env.PINTEREST_CLIENT_ID;
	const clientSecret = process.env.PINTEREST_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error('PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET must be set');
	}

	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
	});

	const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
	const response = await fetch(PINTEREST_OAUTH.TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${credentials}`,
		},
		body: params.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token refresh failed: ${response.status} ${text}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
		token_type: string;
		scope: string;
	};

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? refreshToken,
		expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 30 * 24 * 60 * 60 * 1000),
		tokenType: data.token_type,
		scope: data.scope,
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the Pinterest OAuth authorization URL and open it in the system browser.
 * Returns `{ ok: true }` when the browser was opened, or `{ ok: false, error }`.
 */
export async function initiateOAuthFlow(redirectUri: string): Promise<PinterestAuthResult> {
	const clientId = process.env.PINTEREST_CLIENT_ID;
	if (!clientId) {
		return { ok: false, error: 'PINTEREST_CLIENT_ID is not configured' };
	}

	const state = generateState();
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: PINTEREST_OAUTH.SCOPES.join(','),
		state,
	});

	const authUrl = `${PINTEREST_OAUTH.AUTH_URL}?${params.toString()}`;
	await shell.openExternal(authUrl);
	return { ok: true };
}

/**
 * Handle the OAuth callback once Pinterest redirects back to the app.
 * Validates the `state` parameter, exchanges the code for a token, and persists it.
 */
export async function handleOAuthCallback(
	code: string,
	state: string,
	redirectUri: string,
): Promise<PinterestAuthResult> {
	if (!validateAndConsumeState(state)) {
		return { ok: false, error: 'Invalid or expired OAuth state parameter' };
	}

	try {
		const tokenData = await exchangeCodeForToken(code, redirectUri);
		persistToken(tokenData);
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'Unknown error during token exchange' };
	}
}

/**
 * Retrieve a valid access token, automatically refreshing if expired.
 * Returns `null` when the user is not authenticated.
 */
export async function getValidAccessToken(): Promise<string | null> {
	const token = loadPersistedToken();
	if (!token) return null;

	// If the token is still valid (with 60 s buffer), return it
	if (Date.now() < token.expiresAt - 60_000) {
		return token.accessToken;
	}

	// Attempt refresh
	if (!token.refreshToken) {
		clearPersistedToken();
		return null;
	}

	try {
		const refreshed = await refreshAccessToken(token.refreshToken);
		persistToken(refreshed);
		return refreshed.accessToken;
	} catch {
		clearPersistedToken();
		return null;
	}
}

/** Returns `true` when a (potentially expired but refreshable) token exists. */
export function isAuthenticated(): boolean {
	return loadPersistedToken() !== null;
}

/** Remove stored token and clear in-memory cache. */
export function logout(): void {
	clearPersistedToken();
}
