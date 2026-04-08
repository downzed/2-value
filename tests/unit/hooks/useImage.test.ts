import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImage } from '../../../src/renderer/hooks/useImage';

vi.mock('image-js', () => ({
	readImg: vi.fn(),
}));

describe('useImage', () => {
	it('should initialize with default state', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.currentImage).toBe(null);
		expect(result.current.originalImage).toBe(null);
		expect(result.current.fileName).toBe('');
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
		expect(result.current.invert).toBe(false);
		expect(result.current.hasImage).toBe(false);
	});

	it('should reset controls without clearing image', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(5);
			result.current.setThreshold(128);
			result.current.setInvert(true);
		});

		expect(result.current.blur).toBe(5);
		expect(result.current.threshold).toBe(128);
		expect(result.current.invert).toBe(true);

		act(() => {
			result.current.resetControls();
		});

		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
		expect(result.current.invert).toBe(false);
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
		expect(result.current.invert).toBe(false);
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

	it('should update invert value', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setInvert(true);
		});

		expect(result.current.invert).toBe(true);
	});
});
