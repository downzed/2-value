import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// window.electronAPI mock
// ---------------------------------------------------------------------------

export function createElectronAPIMock() {
	return {
		openImage: vi.fn(),
		getImageInfo: vi.fn(),
		readImageBuffer: vi.fn(),
		saveImage: vi.fn(),
		getRecents: vi.fn().mockResolvedValue([]),
		removeRecent: vi.fn().mockResolvedValue(undefined),
		openImageFromPath: vi.fn(),
	};
}

export function setupElectronAPIMock() {
	const mock = createElectronAPIMock();
	Object.defineProperty(window, 'electronAPI', {
		value: mock,
		writable: true,
		configurable: true,
	});
	return mock;
}

// ---------------------------------------------------------------------------
// ResizeObserver mock (jsdom doesn't implement it)
// ---------------------------------------------------------------------------

export function setupResizeObserverMock() {
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
	return { mock, observe, disconnect };
}

// ---------------------------------------------------------------------------
// HTMLCanvasElement.getContext mock (jsdom doesn't implement canvas rendering)
// ---------------------------------------------------------------------------

export function setupCanvasMock() {
	const putImageData = vi.fn();
	const toBlob = vi.fn();
	const ctx = {
		putImageData,
		clearRect: vi.fn(),
		drawImage: vi.fn(),
	};
	HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
	HTMLCanvasElement.prototype.toBlob = toBlob;
	return { ctx, toBlob };
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
