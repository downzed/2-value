import type { Image } from 'image-js';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EditorStore } from '../../../src/renderer/core/EditorStore';

const createMockImage = (width = 100, height = 100) => ({ clone: () => ({}), width, height }) as unknown as Image;

/** Adjustments belong to an open item, so these tests need one. */
function withImage(): EditorStore {
	const store = new EditorStore();
	void store.loadImage(createMockImage(), 'photo.jpg');
	return store;
}

/** The active item; every caller has just opened one. */
function activeItem(store: EditorStore) {
	const { items, activeItemId } = store.getState();
	const found = items.find((i) => i.id === activeItemId);
	if (!found) throw new Error('No active item');
	return found;
}

describe('EditorStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should initialize with default state', () => {
		const store = new EditorStore();
		const s = store.getState();

		expect(s.items).toEqual([]);
		expect(s.activeItemId).toBe(null);
		expect(store.currentImage).toBe(null);
		expect(store.fileName).toBe('');
		expect(store.hasImage).toBe(false);
		expect(store.hasCanvas).toBe(false);
		expect(store.canvasMode).toBe('image');
		expect(s.zoom).toBe(1);
		expect(s.fitMode).toBe('fit');
		expect(s.counter).toBe(0);
		expect(s.counterRunning).toBe(false);
		expect(s.counterDuration).toBe(null);
		// Only the gallery starts open; the rest open once an item is loaded.
		expect(s.panels).toEqual({
			controls: false,
			original: false,
			timer: false,
			gallery: true,
		});
		expect(store.canUndo).toBe(false);
		expect(store.canRedo).toBe(false);
	});

	it('should reset controls without closing the item', () => {
		const store = withImage();
		store.setBlur(5);
		store.setThreshold(128);

		expect(activeItem(store).blur).toBe(5);
		expect(activeItem(store).threshold).toBe(128);

		store.resetControls();

		expect(activeItem(store).blur).toBe(0);
		expect(activeItem(store).threshold).toBe(0);
		expect(store.getState().counter).toBe(0);
		// The item itself survives a control reset.
		expect(store.getState().items).toHaveLength(1);
		expect(store.hasImage).toBe(true);
	});

	it('should reset image clears all state', () => {
		const store = withImage();

		expect(store.hasImage).toBe(true);

		store.resetImage();

		expect(store.currentImage).toBe(null);
		expect(store.fileName).toBe('');
		expect(store.getState().items).toEqual([]);
		expect(store.getState().activeItemId).toBe(null);
	});

	// --- Opening items ---

	it('should open an item and expose it as the active document', async () => {
		const store = new EditorStore();
		await store.loadImage(createMockImage(), 'photo.jpg');

		expect(store.fileName).toBe('photo.jpg');
		expect(store.hasImage).toBe(true);
		expect(store.getState().items).toHaveLength(1);
		expect(store.getState().activeItemId).toBe(store.getState().items[0].id);
	});

	it('should record gallery metadata so the item is restorable', async () => {
		const store = new EditorStore();
		await store.loadImage(createMockImage(), 'photo.jpg', { galleryImageId: 'g1', thumbUrl: 'blob:thumb' });

		expect(activeItem(store).galleryImageId).toBe('g1');
		expect(activeItem(store).thumbUrl).toBe('blob:thumb');
		expect(store.restorableItemIds).toEqual(['g1']);
	});

	it('should not offer a dirty gallery item for restore', async () => {
		const store = new EditorStore();
		await store.loadImage(createMockImage(), 'photo.jpg', { galleryImageId: 'g1' });
		store.setBlur(3);

		expect(activeItem(store).dirty).toBe(true);
		expect(store.restorableItemIds).toEqual([]);
		expect(store.hasDirtyItems).toBe(true);
	});

	it('should mark an item saved so it is restorable again', async () => {
		const store = new EditorStore();
		await store.loadImage(createMockImage(), 'photo.jpg', { galleryImageId: 'g1' });
		store.setBlur(3);
		store.markActiveSaved();

		expect(activeItem(store).dirty).toBe(false);
		expect(store.restorableItemIds).toEqual(['g1']);
	});

	it('should reactivate an already-open clean source instead of duplicating it', async () => {
		const store = new EditorStore();
		await store.loadImage(createMockImage(), 'a.jpg', { galleryImageId: 'g1' });
		store.newBlankCanvas();
		expect(store.getState().items).toHaveLength(2);

		await store.loadImage(createMockImage(), 'a.jpg', { galleryImageId: 'g1' });

		// Still two: the photo was reactivated, not re-added.
		expect(store.getState().items).toHaveLength(2);
		expect(store.fileName).toBe('a.jpg');
	});

	it('should never merge a dirty source into the existing item', async () => {
		const store = new EditorStore();
		await store.loadImage(createMockImage(), 'a.jpg', { galleryImageId: 'g1' });
		store.setBlur(4);
		store.newBlankCanvas();

		await store.loadImage(createMockImage(), 'a.jpg', { galleryImageId: 'g1' });

		// Unsaved work must not be silently collapsed into the new item.
		expect(store.getState().items).toHaveLength(3);
	});

	it('should close every item on resetImage', async () => {
		const store = withImage();
		expect(store.getState().items).toHaveLength(1);

		store.resetImage();

		expect(store.getState().items).toHaveLength(0);
		expect(store.getState().activeItemId).toBe(null);
		expect(store.fileName).toBe('');
		expect(store.hasCanvas).toBe(false);
	});

	// --- Adjustments ---

	it('should update blur value', () => {
		const store = withImage();
		store.setBlur(7);
		expect(activeItem(store).blur).toBe(7);
	});

	it('should update threshold value', () => {
		const store = withImage();
		store.setThreshold(200);
		expect(activeItem(store).threshold).toBe(200);
	});

	it('should toggle showOriginal', () => {
		const store = withImage();
		expect(activeItem(store).showOriginal).toBe(false);

		store.toggleShowOriginal();
		expect(activeItem(store).showOriginal).toBe(true);

		store.toggleShowOriginal();
		expect(activeItem(store).showOriginal).toBe(false);
	});

	it('should ignore adjustments when no item is open', () => {
		const store = new EditorStore();
		store.setBlur(5);
		expect(store.canUndo).toBe(false);
		expect(store.getState().items).toEqual([]);
	});

	// --- Counter ---

	it('should stop running timer when resetControls is called', () => {
		const store = new EditorStore();
		store.startCounter(10);

		expect(store.getState().counterRunning).toBe(true);
		expect(store.getState().counter).toBe(10);

		store.resetControls();

		expect(store.getState().counterRunning).toBe(false);
		expect(store.getState().counter).toBe(0);

		// Advance time and confirm the interval is cleared.
		vi.advanceTimersByTime(3000);
		expect(store.getState().counter).toBe(0);
		expect(store.getState().counterRunning).toBe(false);
	});

	it('should count down timer and stop at zero', () => {
		const store = new EditorStore();
		store.startCounter(3);

		expect(store.getState().counter).toBe(3);
		expect(store.getState().counterRunning).toBe(true);

		vi.advanceTimersByTime(1000);
		expect(store.getState().counter).toBe(2);

		vi.advanceTimersByTime(3000);
		expect(store.getState().counter).toBe(0);
		expect(store.getState().counterRunning).toBe(false);

		// The interval must be gone, not merely paused at zero.
		vi.advanceTimersByTime(3000);
		expect(store.getState().counter).toBe(0);
	});

	// --- Undo/Redo ---

	it('should undo last blur change', () => {
		const store = withImage();
		store.setBlur(5);
		expect(activeItem(store).blur).toBe(5);
		expect(store.canUndo).toBe(true);

		store.undo();
		expect(activeItem(store).blur).toBe(0);
		expect(store.canUndo).toBe(false);
	});

	it('should redo after undo', () => {
		const store = withImage();
		store.setBlur(5);
		store.undo();
		expect(activeItem(store).blur).toBe(0);
		expect(store.canRedo).toBe(true);

		store.redo();
		expect(activeItem(store).blur).toBe(5);
		expect(store.canRedo).toBe(false);
	});

	it('should clear redo stack on new change after undo', () => {
		const store = withImage();
		store.setBlur(5);
		store.setBlur(10);
		store.undo();
		expect(activeItem(store).blur).toBe(5);
		expect(store.canRedo).toBe(true);

		store.setThreshold(100);
		expect(store.canRedo).toBe(false);
	});

	it('should undo/redo threshold changes', () => {
		const store = withImage();
		store.setThreshold(128);
		store.setThreshold(200);

		store.undo();
		expect(activeItem(store).threshold).toBe(128);

		store.undo();
		expect(activeItem(store).threshold).toBe(0);
	});

	it('should undo/redo values changes', () => {
		const store = withImage();
		store.setValues(3);
		expect(activeItem(store).values).toBe(3);

		store.undo();
		expect(activeItem(store).values).toBe(2);

		store.redo();
		expect(activeItem(store).values).toBe(3);
	});

	it('should clear undo/redo stacks on resetControls', () => {
		const store = withImage();
		store.setBlur(5);
		store.setThreshold(128);
		expect(store.canUndo).toBe(true);

		store.resetControls();
		expect(store.canUndo).toBe(false);
		expect(store.canRedo).toBe(false);
	});

	it('should cap history at max depth', () => {
		const store = withImage();
		for (let i = 1; i <= 55; i++) store.setThreshold(i);

		let undoCount = 0;
		while (store.canUndo) {
			store.undo();
			undoCount++;
		}
		expect(undoCount).toBe(50);
	});

	it('should not change state when undo called with empty history', () => {
		const store = withImage();
		store.undo();
		expect(activeItem(store).blur).toBe(0);
		expect(activeItem(store).threshold).toBe(0);
	});

	it('should not change state when redo called with empty future', () => {
		const store = withImage();
		store.redo();
		expect(activeItem(store).blur).toBe(0);
		expect(activeItem(store).threshold).toBe(0);
	});

	// --- Presets ---

	it('should apply a preset and set all adjustment values', () => {
		const store = withImage();
		store.applyPreset({ blur: 1.5, threshold: 128, values: 2 });

		expect(activeItem(store).blur).toBe(1.5);
		expect(activeItem(store).threshold).toBe(128);
		expect(activeItem(store).values).toBe(2);
	});

	it('should create a single undo entry when applying a preset', () => {
		const store = withImage();
		store.setBlur(3);
		store.applyPreset({ blur: 1.5, threshold: 128, values: 3 });

		expect(activeItem(store).blur).toBe(1.5);
		expect(activeItem(store).values).toBe(3);

		// One undo returns to the state before the preset.
		store.undo();
		expect(activeItem(store).blur).toBe(3);
		expect(activeItem(store).threshold).toBe(0);
		expect(activeItem(store).values).toBe(2);
	});

	// --- Panels ---

	it('should toggle panel visibility', () => {
		const store = new EditorStore();
		store.togglePanel('controls');
		expect(store.getState().panels.controls).toBe(true);

		store.togglePanel('controls');
		expect(store.getState().panels.controls).toBe(false);
	});

	it('should set panel visibility directly', () => {
		const store = new EditorStore();
		store.setPanel('timer', false);
		expect(store.getState().panels.timer).toBe(false);

		store.setPanel('timer', true);
		expect(store.getState().panels.timer).toBe(true);
	});

	it('should not affect other panels when toggling one', () => {
		const store = new EditorStore();
		store.togglePanel('original');
		const panels = store.getState().panels;
		expect(panels.original).toBe(true);
		expect(panels.controls).toBe(false);
		expect(panels.timer).toBe(false);
		expect(panels.gallery).toBe(true);
	});

	it('should not affect gallery when toggling other panels', () => {
		const store = new EditorStore();
		store.setPanel('gallery', true);
		store.togglePanel('controls');

		expect(store.getState().panels.gallery).toBe(true);
		expect(store.getState().panels.controls).toBe(true);
	});

	it('should preserve gallery state across loadImage', async () => {
		const store = new EditorStore();
		store.setPanel('gallery', true);

		// Panels are app-global, so opening an image must not close the gallery.
		await store.loadImage(createMockImage(), 'photo.jpg');
		expect(store.getState().panels.gallery).toBe(true);
	});

	// --- Zoom ---

	it('should set zoom and switch to manual mode', () => {
		const store = new EditorStore();
		store.setZoom(2);
		expect(store.getState().zoom).toBe(2);
		expect(store.getState().fitMode).toBe('manual');
	});

	it('should clamp zoom to minimum', () => {
		const store = new EditorStore();
		store.setZoom(0.1);
		expect(store.getState().zoom).toBe(0.25);
	});

	it('should clamp zoom to maximum', () => {
		const store = new EditorStore();
		store.setZoom(10);
		expect(store.getState().zoom).toBe(4);
	});

	it('should zoom in by step and switch to manual mode', () => {
		const store = new EditorStore();
		store.zoomIn();
		expect(store.getState().zoom).toBe(1.25);
		expect(store.getState().fitMode).toBe('manual');
	});

	it('should zoom out by step and switch to manual mode', () => {
		const store = new EditorStore();
		store.zoomOut();
		expect(store.getState().zoom).toBe(0.75);
		expect(store.getState().fitMode).toBe('manual');
	});

	it('should not zoom below minimum via zoomOut', () => {
		const store = new EditorStore();
		store.setZoom(0.25);
		store.zoomOut();
		expect(store.getState().zoom).toBe(0.25);
	});

	it('should not zoom above maximum via zoomIn', () => {
		const store = new EditorStore();
		store.setZoom(4);
		store.zoomIn();
		expect(store.getState().zoom).toBe(4);
	});

	it('should set fitMode to fit', () => {
		const store = new EditorStore();
		store.setZoom(2);
		expect(store.getState().fitMode).toBe('manual');

		store.setFitMode('fit');
		expect(store.getState().fitMode).toBe('fit');
	});

	it('should reset zoom and fitMode on loadImage', async () => {
		const store = new EditorStore();
		store.setZoom(2.5);
		expect(store.getState().zoom).toBe(2.5);

		await store.loadImage(createMockImage(), 'test.jpg');

		expect(store.getState().zoom).toBe(1);
		expect(store.getState().fitMode).toBe('fit');
	});

	it('should reset zoom and fitMode on resetImage', () => {
		const store = new EditorStore();
		store.setZoom(3);
		store.resetImage();

		expect(store.getState().zoom).toBe(1);
		expect(store.getState().fitMode).toBe('fit');
	});

	// --- Blank canvas mode ---

	describe('blank canvases', () => {
		it('should start with no items and no canvas content', () => {
			const store = new EditorStore();
			expect(store.canvasMode).toBe('image');
			expect(store.hasBlankCanvas).toBe(false);
			expect(store.hasCanvas).toBe(false);
			expect(store.getState().items).toHaveLength(0);
			expect(store.getState().activeItemId).toBe(null);
		});

		it('should create and activate a blank item', () => {
			const store = new EditorStore();
			store.newBlankCanvas();

			expect(store.canvasMode).toBe('blank');
			expect(store.hasBlankCanvas).toBe(true);
			expect(store.hasCanvas).toBe(true);
			expect(store.getState().items).toHaveLength(1);
			expect(store.getState().items[0].kind).toBe('blank');
			expect(store.getState().items[0].label).toBe('Canvas 1');
			// No raster image — the blank surface bypasses the worker.
			expect(store.currentImage).toBe(null);
			expect(store.hasImage).toBe(false);
		});

		it('should number each new blank canvas', () => {
			const store = new EditorStore();
			store.newBlankCanvas();
			store.newBlankCanvas();

			expect(store.getState().items.map((i) => i.label)).toEqual(['Canvas 1', 'Canvas 2']);
		});

		it('should keep an open image when a blank canvas is added', async () => {
			const store = new EditorStore();
			await store.loadImage(createMockImage(), 'photo.jpg');
			store.newBlankCanvas();

			// The photo is still open, just not active.
			expect(store.getState().items).toHaveLength(2);
			expect(store.hasImage).toBe(false);
			expect(store.canvasMode).toBe('blank');
		});

		it('should restore each item when switching between them', async () => {
			const store = new EditorStore();
			await store.loadImage(createMockImage(), 'photo.jpg');
			const photoId = store.getState().activeItemId as string;
			store.setBlur(6);

			store.newBlankCanvas();
			const canvasId = store.getState().activeItemId as string;
			expect(activeItem(store).blur).toBe(0);

			// Back to the photo: its own adjustments come back.
			store.activateItem(photoId);
			expect(store.hasImage).toBe(true);
			expect(store.fileName).toBe('photo.jpg');
			expect(activeItem(store).blur).toBe(6);
			expect(store.canUndo).toBe(true);

			// And forward to the canvas, which keeps its own clean history.
			store.activateItem(canvasId);
			expect(store.canvasMode).toBe('blank');
			expect(activeItem(store).blur).toBe(0);
			expect(store.canUndo).toBe(false);
		});

		it('should give every item its own undo history', async () => {
			const store = new EditorStore();
			await store.loadImage(createMockImage(), 'a.jpg');
			const a = store.getState().activeItemId as string;
			store.setBlur(5);

			store.newBlankCanvas();
			store.setBlur(9);

			// Undo on the canvas must not touch the photo's history.
			store.undo();
			expect(activeItem(store).blur).toBe(0);

			store.activateItem(a);
			expect(activeItem(store).blur).toBe(5);
			store.undo();
			expect(activeItem(store).blur).toBe(0);
		});

		it('should stop a running timer when a blank canvas is added', () => {
			const store = new EditorStore();
			store.startCounter(10);
			expect(store.getState().counterRunning).toBe(true);

			store.newBlankCanvas();
			expect(store.getState().counterRunning).toBe(false);
		});

		it('should reset zoom to fit when adding a canvas', () => {
			const store = new EditorStore();
			store.setZoom(2);
			store.newBlankCanvas();

			expect(store.getState().zoom).toBe(1);
			expect(store.getState().fitMode).toBe('fit');
		});

		it('should leave blank mode when an image is loaded', async () => {
			const store = new EditorStore();
			store.newBlankCanvas();
			await store.loadImage(createMockImage(), 'photo.jpg');

			expect(store.canvasMode).toBe('image');
			expect(store.hasBlankCanvas).toBe(false);
			expect(store.hasImage).toBe(true);
			expect(store.getState().items).toHaveLength(2);
		});

		it('should close the active item and fall back to another', async () => {
			const store = new EditorStore();
			await store.loadImage(createMockImage(), 'a.jpg');
			const a = store.getState().activeItemId as string;
			store.newBlankCanvas();
			const blank = store.getState().activeItemId as string;

			store.closeItem(blank);

			expect(store.getState().items).toHaveLength(1);
			expect(store.getState().activeItemId).toBe(a);
			expect(store.hasImage).toBe(true);
		});

		it('should report no active item once everything is closed', () => {
			const store = new EditorStore();
			store.newBlankCanvas();
			store.closeItem(store.getState().activeItemId as string);

			expect(store.getState().items).toHaveLength(0);
			expect(store.getState().activeItemId).toBe(null);
			expect(store.hasCanvas).toBe(false);
		});

		it('should drop an item strokes when it is closed', () => {
			const store = new EditorStore();
			store.newBlankCanvas();
			const id = store.getState().activeItemId as string;
			store.getStrokes(id).push([0, 0, 1, 1]);

			store.closeItem(id);

			expect(store.strokesByItem.has(id)).toBe(false);
		});

		it('should keep strokes per item so switching restores the drawing', () => {
			const store = new EditorStore();
			store.newBlankCanvas();
			const first = store.getState().activeItemId as string;
			store.getStrokes(first).push([0, 0, 1, 1]);

			store.newBlankCanvas();
			const second = store.getState().activeItemId as string;

			expect(store.getStrokes(first)).toHaveLength(1);
			expect(store.getStrokes(second)).toHaveLength(0);
		});
	});

	// --- Viewport ---

	describe('setViewport', () => {
		it('should store the reported stage size', () => {
			const store = new EditorStore();
			store.setViewport({ width: 1024, height: 768 });
			expect(store.getState().viewport).toEqual({ width: 1024, height: 768 });
		});

		it('should keep the same viewport object when the size is unchanged', () => {
			const store = new EditorStore();
			store.setViewport({ width: 800, height: 600 });
			const first = store.getState().viewport;

			store.setViewport({ width: 800, height: 600 });

			// Identity equality proves the bail-out ran, so a resize observer
			// round-trip cannot drive a render loop.
			expect(store.getState().viewport).toBe(first);
		});

		it('should preserve the stage size across loadImage and newBlankCanvas', async () => {
			const store = new EditorStore();
			store.setViewport({ width: 1024, height: 768 });

			await store.loadImage(createMockImage(), 'photo.jpg');
			expect(store.getState().viewport).toEqual({ width: 1024, height: 768 });

			store.newBlankCanvas();
			expect(store.getState().viewport).toEqual({ width: 1024, height: 768 });
		});

		it('should report blank size only for a blank canvas', () => {
			const store = new EditorStore();
			expect(store.blankSize).toBe(null);

			store.setViewport({ width: 800, height: 600 });
			store.newBlankCanvas();
			expect(store.blankSize).toEqual({ width: 800, height: 600 });

			store.activateItem(store.getState().items[0].id);
		});

		it('should report no blank size for an image item', async () => {
			const store = new EditorStore();
			store.setViewport({ width: 800, height: 600 });
			await store.loadImage(createMockImage(), 'photo.jpg');
			expect(store.blankSize).toBe(null);
		});
	});

	// --- Store plumbing (the reason this class exists) ---

	describe('subscription', () => {
		it('should notify subscribers on a real change', () => {
			const store = new EditorStore();
			const listener = vi.fn();
			store.subscribe(listener);

			store.newBlankCanvas();

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('should not notify when a mutator is a no-op', () => {
			const store = new EditorStore();
			const listener = vi.fn();
			store.subscribe(listener);

			// Same viewport twice, same panel value twice.
			store.setViewport({ width: 800, height: 600 });
			listener.mockClear();
			store.setViewport({ width: 800, height: 600 });
			store.setPanel('gallery', true);
			store.markActiveSaved();

			expect(listener).not.toHaveBeenCalled();
		});

		it('should keep getState referentially stable between mutations', () => {
			const store = new EditorStore();
			const before = store.getState();

			store.setViewport({ width: 800, height: 600 });
			store.setViewport({ width: 800, height: 600 });

			// A changed snapshot is fine; an unchanged *read* must not allocate.
			expect(store.getState()).toBe(store.getState());
			expect(before).not.toBe(store.getState());
		});

		it('should stop notifying after unsubscribe', () => {
			const store = new EditorStore();
			const listener = vi.fn();
			const unsubscribe = store.subscribe(listener);

			store.newBlankCanvas();
			unsubscribe();
			store.newBlankCanvas();

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('should not notify subscribers after dispose', () => {
			const store = new EditorStore();
			const listener = vi.fn();
			store.subscribe(listener);

			store.dispose();
			store.newBlankCanvas();

			expect(listener).not.toHaveBeenCalled();
		});

		it('should clear the timer interval on dispose', () => {
			const store = new EditorStore();
			store.startCounter(5);
			store.dispose();

			// Would tick to 4 if the interval survived disposal.
			vi.advanceTimersByTime(3000);
			expect(store.getState().counter).toBe(5);
		});

		it('should keep subscribe identity stable across reads', () => {
			const store = new EditorStore();
			expect(store.subscribe).toBe(store.subscribe);
			expect(store.getState).toBe(store.getState);
		});
	});
});
