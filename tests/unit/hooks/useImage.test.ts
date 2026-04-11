import { act, renderHook } from '@testing-library/react';
import type { Image } from 'image-js';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useImage } from '../../../src/renderer/hooks/useImage';

vi.mock('image-js', () => ({
	readImg: vi.fn(),
}));

const createMockImage = () => ({ clone: () => ({}) }) as unknown as Image;

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
		expect(result.current.filePath).toBe('');
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
		expect(result.current.showOriginal).toBe(false);
		expect(result.current.counter).toBe(0);
		expect(result.current.counterRunning).toBe(false);
		expect(result.current.counterDuration).toBe(null);
		expect(result.current.hasImage).toBe(false);
		expect(result.current.panels).toEqual({
			controls: true,
			original: true,
			timer: true,
		});
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);
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
		expect(result.current.filePath).toBe('');
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
		expect(result.current.counter).toBe(0);
		expect(result.current.counterRunning).toBe(false);
	});

	it('should expose filePath after loadImage', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg', '/home/user/photo.jpg');
		});

		expect(result.current.fileName).toBe('photo.jpg');
		expect(result.current.filePath).toBe('/home/user/photo.jpg');
		expect(result.current.hasImage).toBe(true);
	});

	it('should default filePath to empty string when not provided', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg');
		});

		expect(result.current.fileName).toBe('photo.jpg');
		expect(result.current.filePath).toBe('');
	});

	it('should clear filePath on resetImage', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg', '/home/user/photo.jpg');
		});
		expect(result.current.filePath).toBe('/home/user/photo.jpg');

		act(() => {
			result.current.resetImage();
		});

		expect(result.current.filePath).toBe('');
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

	// --- Undo/Redo tests ---

	it('should undo last blur change', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(5);
		});
		expect(result.current.blur).toBe(5);
		expect(result.current.canUndo).toBe(true);

		act(() => {
			result.current.undo();
		});
		expect(result.current.blur).toBe(0);
		expect(result.current.canUndo).toBe(false);
	});

	it('should redo after undo', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(5);
		});

		act(() => {
			result.current.undo();
		});
		expect(result.current.blur).toBe(0);
		expect(result.current.canRedo).toBe(true);

		act(() => {
			result.current.redo();
		});
		expect(result.current.blur).toBe(5);
		expect(result.current.canRedo).toBe(false);
	});

	it('should clear redo stack on new change after undo', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(5);
		});
		act(() => {
			result.current.setBlur(10);
		});

		act(() => {
			result.current.undo();
		});
		expect(result.current.blur).toBe(5);
		expect(result.current.canRedo).toBe(true);

		// New change should clear redo stack
		act(() => {
			result.current.setThreshold(100);
		});
		expect(result.current.canRedo).toBe(false);
	});

	it('should undo/redo threshold changes', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setThreshold(128);
		});
		act(() => {
			result.current.setThreshold(200);
		});

		act(() => {
			result.current.undo();
		});
		expect(result.current.threshold).toBe(128);

		act(() => {
			result.current.undo();
		});
		expect(result.current.threshold).toBe(0);
	});

	it('should undo/redo values changes', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setValues(3);
		});
		expect(result.current.values).toBe(3);

		act(() => {
			result.current.undo();
		});
		expect(result.current.values).toBe(2);

		act(() => {
			result.current.redo();
		});
		expect(result.current.values).toBe(3);
	});

	it('should clear undo/redo stacks on resetControls', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(5);
			result.current.setThreshold(128);
		});
		expect(result.current.canUndo).toBe(true);

		act(() => {
			result.current.resetControls();
		});
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);
	});

	it('should cap history at max depth', () => {
		const { result } = renderHook(() => useImage());

		// Push 55 entries (exceeds MAX_DEPTH of 50)
		for (let i = 1; i <= 55; i++) {
			act(() => {
				result.current.setThreshold(i);
			});
		}

		// Should be able to undo 50 times but not 51
		let undoCount = 0;
		while (result.current.canUndo) {
			act(() => {
				result.current.undo();
			});
			undoCount++;
		}
		expect(undoCount).toBe(50);
	});

	it('should not change state when undo called with empty history', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.undo();
		});
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
	});

	it('should not change state when redo called with empty future', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.redo();
		});
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
	});

	// --- Preset tests ---

	it('should apply a preset and set all adjustment values', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.applyPreset({ blur: 1.5, threshold: 128, values: 2 });
		});

		expect(result.current.blur).toBe(1.5);
		expect(result.current.threshold).toBe(128);
		expect(result.current.values).toBe(2);
	});

	it('should create a single undo entry when applying a preset', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setBlur(3);
		});

		act(() => {
			result.current.applyPreset({ blur: 1.5, threshold: 128, values: 3 });
		});

		expect(result.current.blur).toBe(1.5);
		expect(result.current.threshold).toBe(128);
		expect(result.current.values).toBe(3);

		// One undo should go back to the state before preset
		act(() => {
			result.current.undo();
		});
		expect(result.current.blur).toBe(3);
		expect(result.current.threshold).toBe(0);
		expect(result.current.values).toBe(2);
	});

	// --- Panel visibility tests ---

	it('should initialize all panels as open', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.panels.controls).toBe(true);
		expect(result.current.panels.original).toBe(true);
		expect(result.current.panels.timer).toBe(true);
	});

	it('should toggle panel visibility', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.togglePanel('controls');
		});
		expect(result.current.panels.controls).toBe(false);

		act(() => {
			result.current.togglePanel('controls');
		});
		expect(result.current.panels.controls).toBe(true);
	});

	it('should set panel visibility directly', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setPanel('timer', false);
		});
		expect(result.current.panels.timer).toBe(false);

		act(() => {
			result.current.setPanel('timer', true);
		});
		expect(result.current.panels.timer).toBe(true);
	});

	it('should not affect other panels when toggling one', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.togglePanel('original');
		});
		expect(result.current.panels.original).toBe(false);
		expect(result.current.panels.controls).toBe(true);
		expect(result.current.panels.timer).toBe(true);
	});
});
