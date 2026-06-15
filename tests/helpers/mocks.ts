import { vi } from 'vitest';

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
	// Must use `function` constructor so `new ResizeObserver(...)` works
	const mock = vi.fn(function (this: Record<string, unknown>) {
		this.observe = observe;
		this.disconnect = disconnect;
		this.unobserve = unobserve;
	});
	globalThis.ResizeObserver = mock as unknown as typeof ResizeObserver;
	const restore = () => {
		globalThis.ResizeObserver = original;
	};
	return { mock, observe, disconnect, restore };
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

export function createMockImage(width = 100, height = 100) {
	const data = new Uint8ClampedArray(width * height * 4);
	return {
		width,
		height,
		getRawImage: () => ({ data, width, height }),
	};
}

// ---------------------------------------------------------------------------
// Default context value factory
// ---------------------------------------------------------------------------

export function createMockContextValue(overrides: Record<string, unknown> = {}) {
	return {
		currentImage: null,
		originalImage: null,
		fileName: '',
		filePath: '',
		hasImage: false,
		loadImage: vi.fn(),
		resetImage: vi.fn(),
		resetControls: vi.fn(),
		blur: 0,
		threshold: 0,
		values: 2 as const,
		showOriginal: false,
		setBlur: vi.fn(),
		setThreshold: vi.fn(),
		setValues: vi.fn(),
		toggleShowOriginal: vi.fn(),
		applyPreset: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		canUndo: false,
		canRedo: false,
		panels: { controls: true, original: true, timer: true, gallery: false },
		togglePanel: vi.fn(),
		setPanel: vi.fn(),
		zoom: 1,
		fitMode: 'fit' as const,
		fitScale: 1,
		effectiveZoom: 1,
		setZoom: vi.fn(),
		setFitMode: vi.fn(),
		setFitScale: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		counter: 0,
		counterRunning: false,
		counterDuration: null,
		startCounter: vi.fn(),
		stopCounter: vi.fn(),
		...overrides,
	};
}
