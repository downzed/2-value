import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { usePinterestAuth } from '../../../src/renderer/hooks/usePinterestAuth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPinterestAuthStatus = vi.fn();
const mockPinterestAuth = vi.fn();
const mockPinterestLogout = vi.fn();

Object.defineProperty(globalThis, 'window', {
	value: {
		electronAPI: {
			pinterestAuthStatus: mockPinterestAuthStatus,
			pinterestAuth: mockPinterestAuth,
			pinterestLogout: mockPinterestLogout,
		},
	},
	writable: true,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePinterestAuth', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('starts with isChecking=true and isAuthenticated=false', () => {
		mockPinterestAuthStatus.mockResolvedValue({ authenticated: false });
		const { result } = renderHook(() => usePinterestAuth());

		expect(result.current.isChecking).toBe(true);
		expect(result.current.isAuthenticated).toBe(false);
		expect(result.current.error).toBeNull();
	});

	it('sets isAuthenticated=true after status check returns authenticated', async () => {
		mockPinterestAuthStatus.mockResolvedValue({ authenticated: true });
		const { result } = renderHook(() => usePinterestAuth());

		await act(async () => {});

		expect(result.current.isChecking).toBe(false);
		expect(result.current.isAuthenticated).toBe(true);
		expect(result.current.error).toBeNull();
	});

	it('sets isAuthenticated=false after status check returns not authenticated', async () => {
		mockPinterestAuthStatus.mockResolvedValue({ authenticated: false });
		const { result } = renderHook(() => usePinterestAuth());

		await act(async () => {});

		expect(result.current.isChecking).toBe(false);
		expect(result.current.isAuthenticated).toBe(false);
	});

	it('sets error when status check IPC call rejects', async () => {
		mockPinterestAuthStatus.mockRejectedValue(new Error('IPC error'));
		const { result } = renderHook(() => usePinterestAuth());

		await act(async () => {});

		expect(result.current.isChecking).toBe(false);
		expect(result.current.isAuthenticated).toBe(false);
		expect(result.current.error).toBe('IPC error');
	});

	it('sets error message when initiateAuth receives ok:false', async () => {
		mockPinterestAuthStatus.mockResolvedValue({ authenticated: false });
		mockPinterestAuth.mockResolvedValue({ ok: false, error: 'OAuth not configured' });

		const { result } = renderHook(() => usePinterestAuth());
		await act(async () => {});

		await act(async () => {
			await result.current.initiateAuth();
		});

		expect(result.current.error).toBe('OAuth not configured');
	});

	it('clears error before initiateAuth call', async () => {
		mockPinterestAuthStatus.mockRejectedValue(new Error('old error'));
		mockPinterestAuth.mockResolvedValue({ ok: true });

		const { result } = renderHook(() => usePinterestAuth());
		await act(async () => {});

		// error is set from status check
		expect(result.current.error).toBe('old error');

		await act(async () => {
			await result.current.initiateAuth();
		});

		// error cleared before the call, and ok:true so no new error
		expect(result.current.error).toBeNull();
	});

	it('sets error when initiateAuth IPC call rejects', async () => {
		mockPinterestAuthStatus.mockResolvedValue({ authenticated: false });
		mockPinterestAuth.mockRejectedValue(new Error('IPC failed'));

		const { result } = renderHook(() => usePinterestAuth());
		await act(async () => {});

		await act(async () => {
			await result.current.initiateAuth();
		});

		expect(result.current.error).toBe('IPC failed');
	});

	it('sets isAuthenticated=false and clears error after logout', async () => {
		mockPinterestAuthStatus.mockResolvedValue({ authenticated: true });
		mockPinterestLogout.mockResolvedValue(undefined);

		const { result } = renderHook(() => usePinterestAuth());
		await act(async () => {});

		expect(result.current.isAuthenticated).toBe(true);

		await act(async () => {
			await result.current.logout();
		});

		expect(result.current.isAuthenticated).toBe(false);
		expect(result.current.error).toBeNull();
	});

	it('calls pinterestLogout IPC on logout', async () => {
		mockPinterestAuthStatus.mockResolvedValue({ authenticated: false });
		mockPinterestLogout.mockResolvedValue(undefined);

		const { result } = renderHook(() => usePinterestAuth());
		await act(async () => {});

		await act(async () => {
			await result.current.logout();
		});

		expect(mockPinterestLogout).toHaveBeenCalledTimes(1);
	});
});
