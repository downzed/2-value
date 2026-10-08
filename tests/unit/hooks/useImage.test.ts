import { act, renderHook } from '@testing-library/react';
import type { Image } from 'image-js';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useImage } from '../../../src/renderer/hooks/useImage';

vi.mock('image-js', () => ({
	readImg: vi.fn(),
}));

const createMockImage = () => ({ clone: () => ({}), width: 100, height: 100 }) as unknown as Image;

/** Adjustments belong to an open item, so these tests need one. */
function renderWithImage() {
	const hook = renderHook(() => useImage());
	act(() => {
		void hook.result.current.loadImage(createMockImage(), 'photo.jpg');
	});
	return hook;
}

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
		expect(result.current.panels).toEqual({
			controls: true,
			original: true,
			timer: true,
			gallery: false,
		});
		expect(result.current.canUndo).toBe(false);
		expect(result.current.canRedo).toBe(false);
	});

	it('should reset controls without closing the item', () => {
		const { result } = renderWithImage();

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
		// The item itself survives a control reset.
		expect(result.current.items).toHaveLength(1);
		expect(result.current.hasImage).toBe(true);
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

	it('should open an item and expose it as the active document', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg');
		});

		expect(result.current.fileName).toBe('photo.jpg');
		expect(result.current.hasImage).toBe(true);
		expect(result.current.items).toHaveLength(1);
		expect(result.current.activeItemId).toBe(result.current.items[0].id);
	});

	it('should record gallery metadata so the item is restorable', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg', {
				galleryImageId: 'g1',
				thumbUrl: 'blob:thumb',
			});
		});

		const item = result.current.items[0];
		expect(item.galleryImageId).toBe('g1');
		expect(item.thumbUrl).toBe('blob:thumb');
		expect(result.current.restorableItemIds).toEqual(['g1']);
	});

	it('should not offer a dirty gallery item for restore', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg', { galleryImageId: 'g1' });
		});
		act(() => {
			result.current.setBlur(3);
		});

		expect(result.current.items[0].dirty).toBe(true);
		expect(result.current.restorableItemIds).toEqual([]);
		expect(result.current.hasDirtyItems).toBe(true);
	});

	it('should mark an item saved so it is restorable again', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg', { galleryImageId: 'g1' });
		});
		act(() => {
			result.current.setBlur(3);
		});
		act(() => {
			result.current.markActiveSaved();
		});

		expect(result.current.items[0].dirty).toBe(false);
		expect(result.current.restorableItemIds).toEqual(['g1']);
	});

	it('should close every item on resetImage', async () => {
		const { result } = renderHook(() => useImage());

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg');
		});
		expect(result.current.items).toHaveLength(1);

		act(() => {
			result.current.resetImage();
		});

		expect(result.current.items).toHaveLength(0);
		expect(result.current.activeItemId).toBe(null);
		expect(result.current.fileName).toBe('');
		expect(result.current.hasCanvas).toBe(false);
	});

	it('should update blur value', () => {
		const { result } = renderWithImage();

		act(() => {
			result.current.setBlur(7);
		});

		expect(result.current.blur).toBe(7);
	});

	it('should update threshold value', () => {
		const { result } = renderWithImage();

		act(() => {
			result.current.setThreshold(200);
		});

		expect(result.current.threshold).toBe(200);
	});

	it('should toggle showOriginal', () => {
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

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
		const { result } = renderWithImage();

		act(() => {
			result.current.undo();
		});
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
	});

	it('should not change state when redo called with empty future', () => {
		const { result } = renderWithImage();

		act(() => {
			result.current.redo();
		});
		expect(result.current.blur).toBe(0);
		expect(result.current.threshold).toBe(0);
	});

	// --- Preset tests ---

	it('should apply a preset and set all adjustment values', () => {
		const { result } = renderWithImage();

		act(() => {
			result.current.applyPreset({ blur: 1.5, threshold: 128, values: 2 });
		});

		expect(result.current.blur).toBe(1.5);
		expect(result.current.threshold).toBe(128);
		expect(result.current.values).toBe(2);
	});

	it('should create a single undo entry when applying a preset', () => {
		const { result } = renderWithImage();

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
		expect(result.current.panels.gallery).toBe(false);
	});

	// --- Gallery panel tests ---

	it('should initialize gallery panel as closed', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.panels.gallery).toBe(false);
	});

	it('should toggle gallery panel visibility', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.panels.gallery).toBe(false);

		act(() => {
			result.current.togglePanel('gallery');
		});
		expect(result.current.panels.gallery).toBe(true);

		act(() => {
			result.current.togglePanel('gallery');
		});
		expect(result.current.panels.gallery).toBe(false);
	});

	it('should set gallery panel visibility directly', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setPanel('gallery', true);
		});
		expect(result.current.panels.gallery).toBe(true);

		act(() => {
			result.current.setPanel('gallery', false);
		});
		expect(result.current.panels.gallery).toBe(false);
	});

	it('should not affect gallery when toggling other panels', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setPanel('gallery', true);
		});
		expect(result.current.panels.gallery).toBe(true);

		act(() => {
			result.current.togglePanel('controls');
		});
		expect(result.current.panels.gallery).toBe(true);
		expect(result.current.panels.controls).toBe(false);
	});

	it('should preserve gallery state across loadImage', async () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setPanel('gallery', true);
		});
		expect(result.current.panels.gallery).toBe(true);

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'photo.jpg');
		});

		// Panels are app-global now, so opening an image must not close the gallery.
		expect(result.current.panels.gallery).toBe(true);
	});

	// --- Zoom/FitMode tests ---

	it('should initialize with zoom=1 and fitMode=fit', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.zoom).toBe(1);
		expect(result.current.fitMode).toBe('fit');
	});

	it('should set zoom and switch to manual mode', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(2);
		});
		expect(result.current.zoom).toBe(2);
		expect(result.current.fitMode).toBe('manual');
	});

	it('should clamp zoom to minimum', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(0.1);
		});
		expect(result.current.zoom).toBe(0.25);
		expect(result.current.fitMode).toBe('manual');
	});

	it('should clamp zoom to maximum', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(10);
		});
		expect(result.current.zoom).toBe(4);
		expect(result.current.fitMode).toBe('manual');
	});

	it('should zoom in by step and switch to manual mode', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.zoomIn();
		});
		expect(result.current.zoom).toBe(1.25);
		expect(result.current.fitMode).toBe('manual');
	});

	it('should zoom out by step and switch to manual mode', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.zoomOut();
		});
		expect(result.current.zoom).toBe(0.75);
		expect(result.current.fitMode).toBe('manual');
	});

	it('should not zoom below minimum via zoomOut', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(0.25);
		});

		act(() => {
			result.current.zoomOut();
		});
		expect(result.current.zoom).toBe(0.25);
	});

	it('should not zoom above maximum via zoomIn', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(4);
		});

		act(() => {
			result.current.zoomIn();
		});
		expect(result.current.zoom).toBe(4);
	});

	it('should set fitMode to fit', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(2);
		});
		expect(result.current.fitMode).toBe('manual');

		act(() => {
			result.current.setFitMode('fit');
		});
		expect(result.current.fitMode).toBe('fit');
	});

	it('should reset zoom and fitMode on loadImage', async () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(2.5);
		});
		expect(result.current.zoom).toBe(2.5);
		expect(result.current.fitMode).toBe('manual');

		await act(async () => {
			await result.current.loadImage(createMockImage(), 'test.jpg');
		});

		expect(result.current.zoom).toBe(1);
		expect(result.current.fitMode).toBe('fit');
	});

	it('should reset zoom and fitMode on resetImage', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.setZoom(3);
		});
		expect(result.current.zoom).toBe(3);
		expect(result.current.fitMode).toBe('manual');

		act(() => {
			result.current.resetImage();
		});

		expect(result.current.zoom).toBe(1);
		expect(result.current.fitMode).toBe('fit');
	});

	describe('blank canvas mode', () => {
		it('should start with no items and no canvas content', () => {
			const { result } = renderHook(() => useImage());

			expect(result.current.canvasMode).toBe('image');
			expect(result.current.hasBlankCanvas).toBe(false);
			expect(result.current.hasCanvas).toBe(false);
			expect(result.current.items).toHaveLength(0);
			expect(result.current.activeItemId).toBe(null);
		});

		it('should create and activate a blank item', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.newBlankCanvas();
			});

			expect(result.current.canvasMode).toBe('blank');
			expect(result.current.hasBlankCanvas).toBe(true);
			expect(result.current.hasCanvas).toBe(true);
			expect(result.current.items).toHaveLength(1);
			expect(result.current.items[0].kind).toBe('blank');
			expect(result.current.items[0].label).toBe('Canvas 1');
			// No raster image — the blank surface bypasses the worker.
			expect(result.current.currentImage).toBe(null);
			expect(result.current.hasImage).toBe(false);
		});

		it('should number each new blank canvas', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.newBlankCanvas();
			});
			act(() => {
				result.current.newBlankCanvas();
			});

			expect(result.current.items.map((i) => i.label)).toEqual(['Canvas 1', 'Canvas 2']);
		});

		it('should keep an open image when a blank canvas is added', async () => {
			const { result } = renderHook(() => useImage());

			await act(async () => {
				await result.current.loadImage(createMockImage(), 'photo.jpg');
			});
			act(() => {
				result.current.newBlankCanvas();
			});

			// The photo is still open, just not active.
			expect(result.current.items).toHaveLength(2);
			expect(result.current.hasImage).toBe(false);
			expect(result.current.canvasMode).toBe('blank');
		});

		it('should restore each item when switching between them', async () => {
			const { result } = renderHook(() => useImage());

			await act(async () => {
				await result.current.loadImage(createMockImage(), 'photo.jpg');
			});
			const photoId = result.current.activeItemId as string;
			act(() => {
				result.current.setBlur(6);
			});

			act(() => {
				result.current.newBlankCanvas();
			});
			const canvasId = result.current.activeItemId as string;
			expect(result.current.blur).toBe(0);

			// Back to the photo: its own adjustments come back.
			act(() => {
				result.current.activateItem(photoId);
			});
			expect(result.current.hasImage).toBe(true);
			expect(result.current.fileName).toBe('photo.jpg');
			expect(result.current.blur).toBe(6);
			expect(result.current.canUndo).toBe(true);

			// And forward to the canvas, which keeps its own clean history.
			act(() => {
				result.current.activateItem(canvasId);
			});
			expect(result.current.canvasMode).toBe('blank');
			expect(result.current.blur).toBe(0);
			expect(result.current.canUndo).toBe(false);
		});

		it('should give every item its own undo history', async () => {
			const { result } = renderHook(() => useImage());

			await act(async () => {
				await result.current.loadImage(createMockImage(), 'a.jpg');
			});
			const a = result.current.activeItemId as string;
			act(() => {
				result.current.setBlur(5);
			});

			act(() => {
				result.current.newBlankCanvas();
			});
			act(() => {
				result.current.setBlur(9);
			});

			// Undo on the canvas must not touch the photo's history.
			act(() => {
				result.current.undo();
			});
			expect(result.current.blur).toBe(0);

			act(() => {
				result.current.activateItem(a);
			});
			expect(result.current.blur).toBe(5);
			act(() => {
				result.current.undo();
			});
			expect(result.current.blur).toBe(0);
		});

		it('should stop a running timer when a blank canvas is added', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.startCounter(10);
			});
			expect(result.current.counterRunning).toBe(true);

			act(() => {
				result.current.newBlankCanvas();
			});

			expect(result.current.counterRunning).toBe(false);
		});

		it('should reset zoom to fit when adding a canvas', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.setZoom(2);
			});
			act(() => {
				result.current.newBlankCanvas();
			});

			expect(result.current.zoom).toBe(1);
			expect(result.current.fitMode).toBe('fit');
		});

		it('should leave blank mode when an image is loaded', async () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.newBlankCanvas();
			});

			await act(async () => {
				await result.current.loadImage(createMockImage(), 'photo.jpg');
			});

			expect(result.current.canvasMode).toBe('image');
			expect(result.current.hasBlankCanvas).toBe(false);
			expect(result.current.hasImage).toBe(true);
			expect(result.current.items).toHaveLength(2);
		});

		it('should close the active item and fall back to another', async () => {
			const { result } = renderHook(() => useImage());

			await act(async () => {
				await result.current.loadImage(createMockImage(), 'a.jpg');
			});
			const a = result.current.activeItemId as string;
			act(() => {
				result.current.newBlankCanvas();
			});
			const blank = result.current.activeItemId as string;

			act(() => {
				result.current.closeItem(blank);
			});

			expect(result.current.items).toHaveLength(1);
			expect(result.current.activeItemId).toBe(a);
			expect(result.current.hasImage).toBe(true);
		});

		it('should report no active item once everything is closed', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.newBlankCanvas();
			});
			act(() => {
				result.current.closeItem(result.current.activeItemId as string);
			});

			expect(result.current.items).toHaveLength(0);
			expect(result.current.activeItemId).toBe(null);
			expect(result.current.hasCanvas).toBe(false);
		});

		it('should drop an item strokes when it is closed', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.newBlankCanvas();
			});
			const id = result.current.activeItemId as string;
			result.current.strokesByItemRef.current.set(id, [0, 0, 1, 1]);

			act(() => {
				result.current.closeItem(id);
			});

			expect(result.current.strokesByItemRef.current.has(id)).toBe(false);
		});
	});

	describe('setViewport', () => {
		it('should store the reported stage size', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.setViewport({ width: 1024, height: 768 });
			});

			expect(result.current.viewport).toEqual({ width: 1024, height: 768 });
		});

		it('should not create a new state object when the size is unchanged', () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.setViewport({ width: 800, height: 600 });
			});
			const first = result.current.viewport;

			act(() => {
				result.current.setViewport({ width: 800, height: 600 });
			});

			// Identity equality proves the bail-out ran, so a resize observer
			// round-trip cannot drive a render loop.
			expect(result.current.viewport).toBe(first);
		});

		it('should preserve the stage size across loadImage and newBlankCanvas', async () => {
			const { result } = renderHook(() => useImage());

			act(() => {
				result.current.setViewport({ width: 1024, height: 768 });
			});

			await act(async () => {
				await result.current.loadImage(createMockImage(), 'photo.jpg', '');
			});
			expect(result.current.viewport).toEqual({ width: 1024, height: 768 });

			act(() => {
				result.current.newBlankCanvas();
			});
			expect(result.current.viewport).toEqual({ width: 1024, height: 768 });
		});
	});
});
