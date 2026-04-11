import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PinterestBoard, SavePinArgs, SavePinResult } from '../../shared/pinterest-types';
import { usePinterestAuth } from '../hooks/usePinterestAuth';

// ─── Context shape ────────────────────────────────────────────────────────────

interface PinterestContextValue {
	/** Whether the user is authenticated with Pinterest */
	isAuthenticated: boolean;
	/** True while checking or performing an async operation */
	isLoading: boolean;
	/** Last error message, or null */
	error: string | null;
	/** The authenticated user's boards (populated after fetchBoards) */
	boards: PinterestBoard[];
	/** The currently-selected board ID for saving pins */
	selectedBoardId: string | null;

	/** Open the system browser to start the Pinterest OAuth flow */
	initiateAuth: () => Promise<void>;
	/** Clear the stored token and reset state */
	logout: () => Promise<void>;
	/** Load/refresh the list of boards */
	fetchBoards: () => Promise<void>;
	/** Change the selected board */
	selectBoard: (boardId: string | null) => void;
	/** Save an image as a pin to the selected (or specified) board */
	savePin: (args: SavePinArgs) => Promise<SavePinResult>;
	/** Dismiss the current error */
	clearError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PinterestContext = createContext<PinterestContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export const PinterestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const auth = usePinterestAuth();

	const [boards, setBoards] = useState<PinterestBoard[]>([]);
	const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
	const [isBoardsLoading, setIsBoardsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchBoards = useCallback(async () => {
		setIsBoardsLoading(true);
		setError(null);
		try {
			const result = await window.electronAPI.pinterestGetBoards();
			setBoards(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch boards');
		} finally {
			setIsBoardsLoading(false);
		}
	}, []);

	// When the user authenticates, automatically load their boards
	useEffect(() => {
		if (auth.isAuthenticated && boards.length === 0) {
			fetchBoards();
		}
	}, [auth.isAuthenticated, boards.length, fetchBoards]);

	// Bubble auth errors
	useEffect(() => {
		if (auth.error) setError(auth.error);
	}, [auth.error]);

	const selectBoard = useCallback((boardId: string | null) => {
		setSelectedBoardId(boardId);
	}, []);

	const savePin = useCallback(async (args: SavePinArgs): Promise<SavePinResult> => {
		setError(null);
		try {
			const result = await window.electronAPI.pinterestSavePin(args);
			if (!result.ok && result.error) setError(result.error);
			return result;
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to save pin';
			setError(msg);
			return { ok: false, error: msg };
		}
	}, []);

	const clearError = useCallback(() => setError(null), []);

	const value: PinterestContextValue = {
		isAuthenticated: auth.isAuthenticated,
		isLoading: auth.isChecking || isBoardsLoading,
		error,
		boards,
		selectedBoardId,
		initiateAuth: auth.initiateAuth,
		logout: auth.logout,
		fetchBoards,
		selectBoard,
		savePin,
		clearError,
	};

	return <PinterestContext.Provider value={value}>{children}</PinterestContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const usePinterestContext = (): PinterestContextValue => {
	const ctx = useContext(PinterestContext);
	if (!ctx) {
		throw new Error('usePinterestContext must be used within a PinterestProvider');
	}
	return ctx;
};
