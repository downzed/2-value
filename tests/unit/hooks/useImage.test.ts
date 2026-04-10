import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useImage } from '../../../src/renderer/hooks/useImage';

vi.mock('image-js', () => ({
	readImg: vi.fn(),
}));

describe('useImage', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});
	it('should initialize with default state', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.currentImage).toBe(null);
		expect(result.current.originalImage).toBe(null);
		expect(result.current.fileName).toBe('');
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
		expect(result.current.showOriginal).toBe(false);
		expect(result.current.counter).toBe(0);
		expect(result.current.counterRunning).toBe(false);
		expect(result.current.counterDuration).toBe(null);
		expect(result.current.hasImage).toBe(false);
	});

	it('should reset controls without clearing image', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(5);
			result.current.setThreshold(128);
		});

		expect(result.current.blur).toBe(5);
		expect(result.current.threshold).toBe(128);

		act(() => {
			result.current.resetControls();
		});

		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
		expect(result.current.counter).toBe(0);
		expect(result.current.counterRunning).toBe(false);
	});

	it('should reset image clears all state', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(5);
		});

		expect(result.current.hasImage).toBe(false);

		act(() => {
			result.current.resetImage();
		});

		expect(result.current.currentImage).toBe(null);
		expect(result.current.originalImage).toBe(null);
		expect(result.current.fileName).toBe('');
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
		expect(result.current.counter).toBe(0);
		expect(result.current.counterRunning).toBe(false);
	});

	it('should update blur value', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(7);
		});

		expect(result.current.blur).toBe(7);
	});

	it('should update threshold value', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setThreshold(200);
		});

		expect(result.current.threshold).toBe(200);
	});

	it('should toggle showOriginal', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.showOriginal).toBe(false);

		act(() => {
			result.current.toggleShowOriginal();
		});

		expect(result.current.showOriginal).toBe(true);

		act(() => {
			result.current.toggleShowOriginal();
		});

		expect(result.current.showOriginal).toBe(false);
	});

	it('should stop running timer when resetControls is called', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.startCounter(10);
		});

		expect(result.current.counterRunning).toBe(true);
		expect(result.current.counter).toBe(10);

		act(() => {
			result.current.resetControls();
		});

		expect(result.current.counterRunning).toBe(false);
		expect(result.current.counter).toBe(0);

		// Advance time and confirm interval is cleared (counter should not tick)
		act(() => {
			vi.advanceTimersByTime(3000);
		});

		expect(result.current.counter).toBe(0);
		expect(result.current.counterRunning).toBe(false);
	});

	it('should count down timer and stop at zero', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.startCounter(3);
		});

		expect(result.current.counter).toBe(3);
		expect(result.current.counterRunning).toBe(true);

		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(result.current.counter).toBe(2);

		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(result.current.counter).toBe(0);
		expect(result.current.counterRunning).toBe(false);
	});
});
