import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedCallback } from '../../../src/renderer/hooks/useDebouncedCallback';

describe('useDebouncedCallback', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('only executes the last call within the delay window', () => {
		const fn = vi.fn();
		const { result } = renderHook(() => useDebouncedCallback(fn, 150));

		act(() => {
			result.current.call(1);
			result.current.call(2);
			result.current.call(3);
		});

		expect(fn).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(150);
		});

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(3);
	});

	it('does not fire if cancelled before the delay', () => {
		const fn = vi.fn();
		const { result } = renderHook(() => useDebouncedCallback(fn, 150));

		act(() => {
			result.current.call(42);
			result.current.cancel();
		});

		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(fn).not.toHaveBeenCalled();
	});

	it('invokes the latest fn after re-renders', () => {
		const fn1 = vi.fn();
		const fn2 = vi.fn();

		const { result, rerender } = renderHook(({ fn }) => useDebouncedCallback(fn, 150), {
			initialProps: { fn: fn1 },
		});

		act(() => {
			result.current.call('a');
		});

		// Re-render with a new function before the timer fires
		rerender({ fn: fn2 });

		act(() => {
			vi.advanceTimersByTime(150);
		});

		expect(fn1).not.toHaveBeenCalled();
		expect(fn2).toHaveBeenCalledTimes(1);
		expect(fn2).toHaveBeenCalledWith('a');
	});

	it('clears pending timeout on unmount', () => {
		const fn = vi.fn();
		const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 150));

		act(() => {
			result.current.call(99);
		});

		unmount();

		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(fn).not.toHaveBeenCalled();
	});
});
