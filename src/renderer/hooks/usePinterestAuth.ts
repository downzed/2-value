import { useCallback, useEffect, useState } from 'react';
import type { PinterestAuthResult } from '../../shared/pinterest-types';

interface UsePinterestAuthState {
	isAuthenticated: boolean;
	isChecking: boolean;
	error: string | null;
	initiateAuth: () => Promise<void>;
	logout: () => Promise<void>;
}

/**
 * Manages Pinterest authentication state.
 *
 * On mount, checks whether a stored token exists via `pinterestAuthStatus`.
 * Exposes `initiateAuth` to open the OAuth browser flow and `logout` to
 * clear the stored token.
 */
export function usePinterestAuth(): UsePinterestAuthState {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isChecking, setIsChecking] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const checkStatus = useCallback(async () => {
		setIsChecking(true);
		try {
			const result = await window.electronAPI.pinterestAuthStatus();
			setIsAuthenticated(result.authenticated);
		} catch (err) {
			setIsAuthenticated(false);
			setError(err instanceof Error ? err.message : 'Failed to check auth status');
		} finally {
			setIsChecking(false);
		}
	}, []);

	useEffect(() => {
		checkStatus();
	}, [checkStatus]);

	const initiateAuth = useCallback(async () => {
		setError(null);
		try {
			const result: PinterestAuthResult = await window.electronAPI.pinterestAuth();
			if (!result.ok) {
				setError(result.error ?? 'Failed to start authentication');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to start authentication');
		}
		// Auth status will be updated by the callback flow (Phase 2)
	}, []);

	const logout = useCallback(async () => {
		setError(null);
		await window.electronAPI.pinterestLogout();
		setIsAuthenticated(false);
	}, []);

	return { isAuthenticated, isChecking, error, initiateAuth, logout };
}
