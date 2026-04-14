import type { Image } from 'image-js';
import { useCallback, useEffect, useRef } from 'react';
import { UI } from '../constants/ui';
import { imageToUint8Clamped } from '../utils/imageConversion';
import type { ProcessRequest, ProcessResponse } from '../workers/imageProcessor.worker';

export interface ProcessParams {
	blur: number;
	threshold: number;
	values: 2 | 3;
}

export type ProcessResult = { ok: true; imageData: ImageData } | { ok: false };

/**
 * Create a scaled-down preview from a source image.
 * Returns null if no downscaling is needed.
 */
function makePreviewPixels(
	source: Image,
	maxPixels: number,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } | null {
	const pixels = source.width * source.height;
	if (pixels <= maxPixels) {
		return null;
	}
	const scale = Math.sqrt(maxPixels / pixels);
	const pw = Math.max(1, Math.floor(source.width * scale));
	const ph = Math.max(1, Math.floor(source.height * scale));

	// Draw source into a temporary OffscreenCanvas at original size, then scale down
	const srcCanvas = new OffscreenCanvas(source.width, source.height);
	const srcCtx = srcCanvas.getContext('2d');
	if (!srcCtx) return null;

	const { data: srcData } = imageToUint8Clamped(source);
	// putImageData needs concrete ArrayBuffer — srcData already has one
	const srcImgData = new ImageData(srcData, source.width, source.height);
	srcCtx.putImageData(srcImgData, 0, 0);

	const dstCanvas = new OffscreenCanvas(pw, ph);
	const dstCtx = dstCanvas.getContext('2d');
	if (!dstCtx) return null;
	dstCtx.drawImage(srcCanvas, 0, 0, pw, ph);
	const scaled = dstCtx.getImageData(0, 0, pw, ph);
	return {
		data: new Uint8ClampedArray(scaled.data.buffer.slice(0)) as Uint8ClampedArray<ArrayBuffer>,
		width: pw,
		height: ph,
	};
}

/**
 * Hook that manages a Web Worker for off-main-thread image processing.
 * Implements latest-wins cancellation: stale job responses are ignored.
 */
export function useImageProcessingWorker() {
	const workerRef = useRef<Worker | null>(null);
	const jobIdRef = useRef(0);
	const pendingCallbackRef = useRef<Map<number, (result: ProcessResult) => void>>(new Map());

	useEffect(() => {
		let worker: Worker | undefined;
		try {
			// Use dynamic import via Vite's worker import syntax.
			// The ?worker suffix is a Vite convention; we use the Worker constructor
			// with a relative URL string so it works after bundling.
			worker = new Worker(new URL('../workers/imageProcessor.worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (e: MessageEvent<ProcessResponse>) => {
				const { jobId, data, width, height } = e.data;
				const cb = pendingCallbackRef.current.get(jobId);
				if (cb) {
					pendingCallbackRef.current.delete(jobId);
					// Ensure concrete ArrayBuffer for ImageData constructor
					const buf = new Uint8ClampedArray(data.buffer.slice(0)) as Uint8ClampedArray<ArrayBuffer>;
					const imageData = new ImageData(buf, width, height);
					cb({ ok: true, imageData });
				}
				// If no callback — this was a stale/cancelled job; ignore.
			};
			worker.onerror = () => {
				// Notify all pending callbacks of failure
				for (const cb of pendingCallbackRef.current.values()) {
					cb({ ok: false });
				}
				pendingCallbackRef.current.clear();
			};
			workerRef.current = worker;
		} catch {
			workerRef.current = null;
		}

		return () => {
			worker?.terminate();
			workerRef.current = null;
			pendingCallbackRef.current.clear();
		};
	}, []);

	/**
	 * Submit a processing job.
	 * - Cancels any in-flight jobs (latest-wins).
	 * - For images > PREVIEW_MAX_PIXELS, processes a downscaled preview.
	 * - Falls back to returning raw source data if worker is unavailable.
	 *
	 * Returns a cleanup function to cancel the job if the component unmounts.
	 */
	const process = useCallback(
		(
			source: Image,
			params: ProcessParams,
			isPreview: boolean,
			callback: (result: ProcessResult) => void,
		): (() => void) => {
			const worker = workerRef.current;

			// Cancel any in-flight callbacks (latest-wins)
			pendingCallbackRef.current.clear();

			const jobId = ++jobIdRef.current;

			let pixelSource: { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number };

			if (isPreview) {
				const preview = makePreviewPixels(source, UI.PERF.PREVIEW_MAX_PIXELS);
				pixelSource = preview ?? imageToUint8Clamped(source);
			} else {
				pixelSource = imageToUint8Clamped(source);
			}

			if (!worker) {
				// Synchronous fallback — return raw data without processing
				try {
					const buf = new Uint8ClampedArray(pixelSource.data.buffer.slice(0)) as Uint8ClampedArray<ArrayBuffer>;
					const imageData = new ImageData(buf, pixelSource.width, pixelSource.height);
					callback({ ok: true, imageData });
				} catch {
					callback({ ok: false });
				}
				return () => {};
			}

			// Register callback before posting to avoid race
			pendingCallbackRef.current.set(jobId, callback);

			const req: ProcessRequest = {
				jobId,
				data: pixelSource.data,
				width: pixelSource.width,
				height: pixelSource.height,
				blur: params.blur,
				threshold: params.threshold,
				values: params.values,
				threeZoneBoundary: UI.FILTER.THREE_ZONE_BOUNDARY,
			};

			// Transfer the data buffer to the worker (zero-copy)
			worker.postMessage(req, [req.data.buffer as ArrayBuffer]);

			return () => {
				// Cancel: remove the callback so the response is ignored
				pendingCallbackRef.current.delete(jobId);
			};
		},
		[],
	);

	return { process };
}
