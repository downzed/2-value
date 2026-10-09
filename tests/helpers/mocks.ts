import { vi } from 'vitest';
import type { Image as ImageJS } from 'image-js';
import type { GalleryState } from '../../src/renderer/core/GalleryStore';
import type { EditorState, OpenItem } from '../../src/renderer/core/types';

// ---------------------------------------------------------------------------
// IndexedDB mock (jsdom doesn't implement it)
// ---------------------------------------------------------------------------

interface MockIDBStore {
	[key: string]: unknown;
}

class MockIDBObjectStore {
	private store: MockIDBStore = {};

	get(key: string) {
		return Promise.resolve(this.store[key]);
	}

	getAll() {
		return Promise.resolve(Object.values(this.store));
	}

	put(value: { id: string } & Record<string, unknown>) {
		this.store[value.id] = value;
		return Promise.resolve();
	}

	delete(key: string) {
		delete this.store[key];
		return Promise.resolve();
	}

	clear() {
		this.store = {};
		return Promise.resolve();
	}
}

class MockIDBTransaction {
	private stores: Record<string, MockIDBObjectStore> = {};

	constructor(storeNames: string[]) {
		for (const name of storeNames) {
			this.stores[name] = new MockIDBObjectStore();
		}
	}

	objectStore(name: string): MockIDBObjectStore {
		return this.stores[name];
	}
}

export function setupIndexedDBMock() {
	const stores: Record<string, MockIDBObjectStore> = {};

	const mockDB = {
		transaction: vi.fn((storeNames: string | string[]) => {
			const names = Array.isArray(storeNames) ? storeNames : [storeNames];
			const tx = new MockIDBTransaction(names);
			for (const name of names) {
				if (!stores[name]) stores[name] = new MockIDBObjectStore();
				vi.spyOn(tx, 'objectStore').mockReturnValue(stores[name]);
			}
			return tx;
		}),
		close: vi.fn(),
	};

	const open = vi.fn().mockReturnValue({
		result: mockDB,
		error: null,
		onsuccess: null,
		onerror: null,
		onupgradeneeded: null,
	});

	Object.defineProperty(globalThis, 'indexedDB', {
		value: { open },
		writable: true,
		configurable: true,
	});

	return { mockDB, stores, open };
}

// ---------------------------------------------------------------------------
// URL.createObjectURL / URL.revokeObjectURL mock (jsdom may not support it)
// ---------------------------------------------------------------------------

const urlMap = new Map<string, string>();

export function setupURLMock() {
	const originalCreate = URL.createObjectURL;
	const originalRevoke = URL.revokeObjectURL;

	URL.createObjectURL = vi.fn((_blob: Blob) => {
		const url = `blob:mock/${Math.random().toString(36).slice(2)}`;
		urlMap.set(url, '');
		return url;
	});

	URL.revokeObjectURL = vi.fn((url: string) => {
		urlMap.delete(url);
	});

	return () => {
		URL.createObjectURL = originalCreate;
		URL.revokeObjectURL = originalRevoke;
	};
}

// ---------------------------------------------------------------------------
// ResizeObserver mock (jsdom doesn't implement it)
// ---------------------------------------------------------------------------

export function setupResizeObserverMock() {
	const original = globalThis.ResizeObserver;
	const observe = vi.fn();
	const disconnect = vi.fn();
	const unobserve = vi.fn();
	let captured: ResizeObserverCallback | null = null;
	// Must use `function` constructor so `new ResizeObserver(...)` works
	const mock = vi.fn(function (this: Record<string, unknown>, callback: ResizeObserverCallback) {
		this.observe = observe;
		this.disconnect = disconnect;
		this.unobserve = unobserve;
		captured = callback;
	});
	globalThis.ResizeObserver = mock as unknown as typeof ResizeObserver;
	// Drive the most recently constructed observer's callback the way a browser
	// would on resize. jsdom never fires these on its own.
	const emitSize = (width: number, height: number) => {
		captured?.([{ contentRect: { width, height } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
	};
	const restore = () => {
		globalThis.ResizeObserver = original;
	};
	return { mock, observe, disconnect, emitSize, restore };
}

// ---------------------------------------------------------------------------
// HTMLCanvasElement.getContext mock (jsdom doesn't implement canvas rendering)
// ---------------------------------------------------------------------------

export function setupCanvasMock() {
	const originalGetContext = HTMLCanvasElement.prototype.getContext;
	const originalToBlob = HTMLCanvasElement.prototype.toBlob;
	const putImageData = vi.fn();
	const toBlob = vi.fn();
	const ctx = {
		putImageData,
		clearRect: vi.fn(),
		drawImage: vi.fn(),
		// Blank-canvas brush drawing
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		arc: vi.fn(),
		stroke: vi.fn(),
		fill: vi.fn(),
		fillRect: vi.fn(),
		strokeStyle: '',
		fillStyle: '',
		lineWidth: 0,
		lineCap: '',
		lineJoin: '',
	};
	HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
	HTMLCanvasElement.prototype.toBlob = toBlob;
	const restore = () => {
		HTMLCanvasElement.prototype.getContext = originalGetContext;
		HTMLCanvasElement.prototype.toBlob = originalToBlob;
	};
	return { ctx, toBlob, restore };
}

// ---------------------------------------------------------------------------
// Pointer capture mock (jsdom doesn't implement the Pointer Capture API)
// ---------------------------------------------------------------------------

export function setupPointerCaptureMock() {
	const originalSet = Element.prototype.setPointerCapture;
	const originalRelease = Element.prototype.releasePointerCapture;
	const originalHas = Element.prototype.hasPointerCapture;

	const setPointerCapture = vi.fn();
	const releasePointerCapture = vi.fn();
	// Default true so endStroke takes the release path, matching a real browser
	// where capture was taken on pointerdown.
	const hasPointerCapture = vi.fn(() => true);

	Element.prototype.setPointerCapture = setPointerCapture;
	Element.prototype.releasePointerCapture = releasePointerCapture;
	Element.prototype.hasPointerCapture = hasPointerCapture;

	const restore = () => {
		Element.prototype.setPointerCapture = originalSet;
		Element.prototype.releasePointerCapture = originalRelease;
		Element.prototype.hasPointerCapture = originalHas;
	};
	return { setPointerCapture, releasePointerCapture, hasPointerCapture, restore };
}

// ---------------------------------------------------------------------------
// getBoundingClientRect mock for a canvas (jsdom returns all zeros, which
// would make pointer -> canvas coordinate mapping meaningless)
// ---------------------------------------------------------------------------

export function stubBoundingRect(element: Element, rect: Partial<DOMRect>) {
	const full = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...rect };
	element.getBoundingClientRect = () => full as DOMRect;
	return () => {
		delete (element as { getBoundingClientRect?: unknown }).getBoundingClientRect;
	};
}

// ---------------------------------------------------------------------------
// ImageData mock (jsdom may not always have it)
// ---------------------------------------------------------------------------

export function setupImageDataMock() {
	if (typeof globalThis.ImageData === 'undefined') {
		globalThis.ImageData = vi.fn(function (
			this: Record<string, unknown>,
			data: Uint8ClampedArray,
			width: number,
			height: number,
		) {
			this.data = data;
			this.width = width;
			this.height = height;
		}) as unknown as typeof ImageData;
	}
}

// ---------------------------------------------------------------------------
// Mock image-js Image object
// ---------------------------------------------------------------------------

/**
 * Minimal stand-in for an image-js `Image`.
 *
 * Only the members component tests actually touch are implemented, so the cast
 * is deliberate: satisfying the full `Image` interface would add ~80 irrelevant
 * members to every test.
 */
export function createMockImage(width = 100, height = 100): ImageJS {
	const data = new Uint8ClampedArray(width * height * 4);
	return {
		width,
		height,
		getRawImage: () => ({ data, width, height }),
	} as unknown as ImageJS;
}

// Store mocks (Phase 4)
//
// Components now read the singleton stores via selectors in
// src/renderer/react/useStore.ts. Tests mock that module, running each selector
// against a plain state object, so no store instance or React context is needed.
// ---------------------------------------------------------------------------

export function createOpenItem(overrides: Partial<OpenItem> = {}): OpenItem {
	return {
		id: 'item-1',
		kind: 'image',
		label: 'photo.jpg',
		fileName: 'photo.jpg',
		image: null,
		width: 100,
		height: 100,
		galleryImageId: null,
		dedupeKey: null,
		thumbUrl: null,
		blur: 0,
		threshold: 0,
		values: 2,
		showOriginal: false,
		history: [],
		future: [],
		dirty: false,
		...overrides,
	};
}

export function createEditorState(overrides: Partial<EditorState> = {}): EditorState {
	return {
		items: [],
		activeItemId: null,
		viewport: { width: 0, height: 0 },
		zoom: 1,
		fitMode: 'fit',
		fitScale: 1,
		counter: 0,
		counterRunning: false,
		counterDuration: null,
		panels: { controls: true, original: true, timer: true, gallery: false },
		...overrides,
	};
}

export function createGalleryState(overrides: Partial<GalleryState> = {}): GalleryState {
	return {
		folders: [],
		images: [],
		selectedFolderId: null,
		gallerySearchQuery: '',
		loading: false,
		error: null,
		...overrides,
	};
}

/** Every EditorStore method a component may reach for, as a spy. */
export function createEditorStoreStub(overrides: Record<string, unknown> = {}) {
	const strokesByItem = new Map<string, number[]>();
	return {
		strokesByItem,
		getStrokes: vi.fn((id: string) => {
			let list = strokesByItem.get(id);
			if (!list) {
				list = [];
				strokesByItem.set(id, list);
			}
			return list;
		}),
		loadImage: vi.fn(),
		newBlankCanvas: vi.fn(),
		activateItem: vi.fn(),
		closeItem: vi.fn(),
		resetImage: vi.fn(),
		resetControls: vi.fn(),
		markActiveSaved: vi.fn(),
		markActiveDirty: vi.fn(),
		linkGalleryImage: vi.fn(),
		setBlur: vi.fn(),
		setThreshold: vi.fn(),
		setValues: vi.fn(),
		toggleShowOriginal: vi.fn(),
		applyPreset: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		togglePanel: vi.fn(),
		setPanel: vi.fn(),
		setZoom: vi.fn(),
		setFitMode: vi.fn(),
		setFitScale: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		setViewport: vi.fn(),
		startCounter: vi.fn(),
		stopCounter: vi.fn(),
		stopTimer: vi.fn(),
		dispose: vi.fn(),
		...overrides,
	};
}

/** Every GalleryStore method a component may reach for, as a spy. */
export function createGalleryStoreStub(overrides: Record<string, unknown> = {}) {
	return {
		loadGallery: vi.fn(),
		createFolder: vi.fn(),
		renameFolder: vi.fn(),
		deleteFolder: vi.fn(),
		updateFolderTags: vi.fn(),
		importImage: vi.fn(),
		saveImageToGallery: vi.fn(),
		moveImage: vi.fn(),
		copyImage: vi.fn(),
		deleteImage: vi.fn(),
		getImageBlob: vi.fn(),
		openGalleryImage: vi.fn(),
		setSelectedFolder: vi.fn(),
		setGallerySearchQuery: vi.fn(),
		clearError: vi.fn(),
		dispose: vi.fn(),
		...overrides,
	};
}

/** Every Commands method, as a spy. */
export function createCommandsStub(overrides: Record<string, unknown> = {}) {
	return {
		openFile: vi.fn().mockResolvedValue({ ok: true }),
		openGalleryImage: vi.fn().mockResolvedValue({ ok: true }),
		saveActiveItemToGallery: vi.fn().mockResolvedValue(undefined),
		saveOpenItem: vi.fn().mockResolvedValue(undefined),
		renderItemToBlob: vi.fn().mockResolvedValue(null),
		exportOpenItem: vi.fn().mockResolvedValue(undefined),
		exportGalleryImage: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
		...overrides,
	};
}
