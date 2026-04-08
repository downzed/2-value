import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useImageProcessingWorker } from '../../../src/renderer/hooks/useImageProcessingWorker';

// ---------------------------------------------------------------------------
// Mock Worker
// ---------------------------------------------------------------------------

let capturedOnMessage: ((e: MessageEvent) => void) | null = null;
let capturedOnError: (() => void) | null = null;
const mockPostMessage = vi.fn();
const mockTerminate = vi.fn();

class MockWorker {
	onmessage: ((e: MessageEvent) => void) | null = null;
	onerror: (() => void) | null = null;

	constructor() {
		capturedOnMessage = null;
		capturedOnError = null;
		// Capture handlers set by the hook
		Object.defineProperty(this, 'onmessage', {
			get: () => capturedOnMessage,
			set: (fn) => {
				capturedOnMessage = fn;
			},
		});
		Object.defineProperty(this, 'onerror', {
			get: () => capturedOnError,
			set: (fn) => {
				capturedOnError = fn;
			},
		});
	}
	postMessage = mockPostMessage;
	terminate = mockTerminate;
}

// @ts-expect-error: MockWorker is a compatible stand-in for Worker
globalThis.Worker = MockWorker;

// Mock OffscreenCanvas for makePreviewImageData
const mockDrawImage = vi.fn();
const mockPutImageData = vi.fn();
const mockGetImageDataFn = vi.fn(() => ({
	data: new Uint8ClampedArray(4),
}));
const mockCtxObj = {
	drawImage: mockDrawImage,
	putImageData: mockPutImageData,
	getImageData: mockGetImageDataFn,
};
// Mock OffscreenCanvas — must use `function` for proper `new` behaviour in Vitest 4
globalThis.OffscreenCanvas = vi.fn(function (this: Record<string, unknown>, w: number, h: number) {
	this.width = w;
	this.height = h;
	this.getContext = vi.fn(() => mockCtxObj);
}) as unknown as typeof OffscreenCanvas;

// Mock ImageData — jsdom does not provide it
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function makeMockSource(width = 100, height = 100) {
	const data = new Uint8ClampedArray(width * height * 4);
	return {
		width,
		height,
		data,
		getRawImage: () => ({ data, width, height }),
	};
}

describe('useImageProcessingWorker', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('posts a message to the worker on process()', () => {
		const { result } = renderHook(() => useImageProcessingWorker());
		const source = makeMockSource();
		const cb = vi.fn();

		act(() => {
			result.current.process(source as never, { blur: 0, threshold: 0, values: 2 }, false, cb);
		});

		expect(mockPostMessage).toHaveBeenCalledTimes(1);
		const req = mockPostMessage.mock.calls[0][0];
		expect(req.blur).toBe(0);
		expect(req.threshold).toBe(0);
		expect(req.values).toBe(2);
		expect(req.jobId).toBeGreaterThan(0);
	});

	it('calls callback with ok:true when worker responds', () => {
		const { result } = renderHook(() => useImageProcessingWorker());
		const source = makeMockSource(10, 10);
		const cb = vi.fn();

		act(() => {
			result.current.process(source as never, { blur: 1, threshold: 100, values: 2 }, false, cb);
		});

		const jobId = mockPostMessage.mock.calls[0][0].jobId as number;

		// Simulate worker response
		act(() => {
			capturedOnMessage?.({
				data: {
					jobId,
					data: new Uint8ClampedArray(10 * 10 * 4),
					width: 10,
					height: 10,
				},
			} as MessageEvent);
		});

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb.mock.calls[0][0].ok).toBe(true);
	});

	it('latest-wins: stale job response is ignored when newer job is in flight', () => {
		const { result } = renderHook(() => useImageProcessingWorker());
		const source = makeMockSource(10, 10);
		const cb1 = vi.fn();
		const cb2 = vi.fn();

		let jobId1: number;
		let jobId2: number;

		act(() => {
			result.current.process(source as never, { blur: 0, threshold: 0, values: 2 }, false, cb1);
			jobId1 = mockPostMessage.mock.calls[0][0].jobId as number;

			// Second process call cancels the first
			result.current.process(source as never, { blur: 2, threshold: 100, values: 2 }, false, cb2);
			jobId2 = mockPostMessage.mock.calls[1][0].jobId as number;
		});

		// Stale response for job1
		act(() => {
			capturedOnMessage?.({
				data: { jobId: jobId1, data: new Uint8ClampedArray(4), width: 1, height: 1 },
			} as MessageEvent);
		});
		expect(cb1).not.toHaveBeenCalled();

		// Fresh response for job2
		act(() => {
			capturedOnMessage?.({
				data: { jobId: jobId2, data: new Uint8ClampedArray(10 * 10 * 4), width: 10, height: 10 },
			} as MessageEvent);
		});
		expect(cb2).toHaveBeenCalledTimes(1);
		expect(cb2.mock.calls[0][0].ok).toBe(true);
	});

	it('cancel return function prevents callback from being called', () => {
		const { result } = renderHook(() => useImageProcessingWorker());
		const source = makeMockSource(10, 10);
		const cb = vi.fn();

		let cancel: () => void;
		act(() => {
			cancel = result.current.process(source as never, { blur: 0, threshold: 0, values: 2 }, false, cb);
		});
		const jobId = mockPostMessage.mock.calls[0][0].jobId as number;

		// Cancel before response arrives
		act(() => {
			cancel();
		});

		act(() => {
			capturedOnMessage?.({
				data: { jobId, data: new Uint8ClampedArray(4), width: 1, height: 1 },
			} as MessageEvent);
		});

		expect(cb).not.toHaveBeenCalled();
	});

	it('terminates worker on unmount', () => {
		const { unmount } = renderHook(() => useImageProcessingWorker());
		unmount();
		expect(mockTerminate).toHaveBeenCalledTimes(1);
	});
});
