import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UI } from '../../../src/renderer/constants/ui';
import { imageLoadErrorMessage, useImageLoader } from '../../../src/renderer/hooks/useImageLoader';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock ImageContext so useImageLoader can be tested standalone
const mockLoadImage = vi.fn();
vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: () => ({ loadImage: mockLoadImage }),
}));

// Mock createImageBitmap used inside decodeBytesToImage
const mockBitmapClose = vi.fn();
const mockBitmap = {
	width: 100,
	height: 80,
	close: mockBitmapClose,
};
globalThis.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

// Mock OffscreenCanvas — must use `function` for proper `new` behaviour in Vitest 4
const mockGetImageData = vi.fn(() => ({
	data: new Uint8ClampedArray(100 * 80 * 4),
}));
const mockCtx = {
	drawImage: vi.fn(),
	getImageData: mockGetImageData,
};
globalThis.OffscreenCanvas = vi.fn(function (this: Record<string, unknown>, w: number, h: number) {
	this.width = w;
	this.height = h;
	this.getContext = vi.fn(() => mockCtx);
}) as unknown as typeof OffscreenCanvas;

// Mock Blob — must use `function` for proper `new` behaviour in Vitest 4
globalThis.Blob = vi.fn(function (this: Record<string, unknown>) {
	// empty blob mock
}) as unknown as typeof Blob;

// Mock image-js Image constructor — must use `function` for proper `new` behaviour in Vitest 4
vi.mock('image-js', () => {
	const MockImage = vi.fn(function (this: Record<string, unknown>, width: number, height: number) {
		this.width = width;
		this.height = height;
		this.data = new Uint8ClampedArray(4); // small stub — tests only need width/height
	});
	return { Image: MockImage, readImg: vi.fn() };
});

// Mock electronAPI
const mockReadImageBuffer = vi.fn().mockResolvedValue(new Uint8Array(10));
Object.defineProperty(globalThis, 'window', {
	value: {
		electronAPI: {
			readImageBuffer: mockReadImageBuffer,
		},
	},
	writable: true,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useImageLoader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadImageBuffer.mockResolvedValue(new Uint8Array(10));
		mockLoadImage.mockResolvedValue(undefined);
		(globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValue(mockBitmap);
		mockGetImageData.mockReturnValue({ data: new Uint8ClampedArray(100 * 80 * 4) });
	});

	it('returns ok:true when image is within limits', async () => {
		const { result } = renderHook(() => useImageLoader());

		let outcome: Awaited<ReturnType<typeof result.current.loadFromPath>>;
		await act(async () => {
			outcome = await result.current.loadFromPath('/test/image.png', 1024);
		});
		expect(outcome?.ok).toBe(true);
		expect(mockLoadImage).toHaveBeenCalledTimes(1);
		expect(mockBitmapClose).toHaveBeenCalledTimes(1);
	});

	it('returns FILE_TOO_LARGE error when fileSize exceeds MAX_FILE_BYTES', async () => {
		const { result } = renderHook(() => useImageLoader());

		let outcome: Awaited<ReturnType<typeof result.current.loadFromPath>>;
		await act(async () => {
			outcome = await result.current.loadFromPath('/test/image.png', UI.PERF.MAX_FILE_BYTES + 1);
		});
		expect(outcome?.ok).toBe(false);
		if (!outcome?.ok) {
			expect(outcome?.error.code).toBe('FILE_TOO_LARGE');
		}
		expect(mockReadImageBuffer).not.toHaveBeenCalled();
	});

	it('returns TOO_MANY_PIXELS error when pixel count exceeds MAX_PIXELS', async () => {
		// Make bitmap appear huge
		const hugeBitmap = { ...mockBitmap, width: 10000, height: 5000 };
		(globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce(hugeBitmap);
		// Use a small stub — the pixel count comes from bitmap/Image dimensions, not data size
		mockGetImageData.mockReturnValueOnce({ data: new Uint8ClampedArray(4) });

		const { result } = renderHook(() => useImageLoader());

		let outcome: Awaited<ReturnType<typeof result.current.loadFromPath>>;
		await act(async () => {
			outcome = await result.current.loadFromPath('/test/big.png', 1024);
		});
		expect(outcome?.ok).toBe(false);
		if (!outcome?.ok) {
			expect(outcome?.error.code).toBe('TOO_MANY_PIXELS');
		}
		// bitmap.close() is called in the TOO_MANY_PIXELS rejection path
		expect(mockBitmapClose).toHaveBeenCalledTimes(1);
	});

	it('returns DECODE_FAILED when readImageBuffer throws', async () => {
		mockReadImageBuffer.mockRejectedValueOnce(new Error('IPC error'));
		const { result } = renderHook(() => useImageLoader());

		let outcome: Awaited<ReturnType<typeof result.current.loadFromPath>>;
		await act(async () => {
			outcome = await result.current.loadFromPath('/test/bad.png', 1024);
		});
		expect(outcome?.ok).toBe(false);
		if (!outcome?.ok) {
			expect(outcome?.error.code).toBe('DECODE_FAILED');
		}
	});

	it('does not call loadImage when file is too large', async () => {
		const { result } = renderHook(() => useImageLoader());
		await act(async () => {
			await result.current.loadFromPath('/test/image.png', UI.PERF.MAX_FILE_BYTES + 100);
		});
		expect(mockLoadImage).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// imageLoadErrorMessage tests
// ---------------------------------------------------------------------------

describe('imageLoadErrorMessage', () => {
	it('formats FILE_TOO_LARGE with MB limit', () => {
		const msg = imageLoadErrorMessage({ code: 'FILE_TOO_LARGE', fileSize: 30_000_000, maxBytes: 25 * 1024 * 1024 });
		expect(msg).toContain('25 MB');
	});

	it('returns message for TOO_MANY_PIXELS', () => {
		const msg = imageLoadErrorMessage({ code: 'TOO_MANY_PIXELS', pixels: 50_000_000, maxPixels: 40_000_000 });
		expect(msg).toContain('too large');
	});

	it('returns message for DECODE_FAILED', () => {
		const msg = imageLoadErrorMessage({ code: 'DECODE_FAILED', cause: new Error('bad') });
		expect(msg).toContain('decode');
	});
});
