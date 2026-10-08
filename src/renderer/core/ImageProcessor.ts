import { UI } from '../constants/ui';
import { imageToUint8Clamped } from '../utils/imageConversion';
import type { ProcessRequest, ProcessResponse } from '../workers/imageProcessor.worker';

export interface ProcessParams {
	blur: number;
	threshold: number;
	values: 2 | 3;
}

export type ProcessResult = { ok: true; imageData: ImageData } | { ok: false };

type PixelSource = { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number };

/**
 * Create a scaled-down preview from a source image.
 * Returns null if no downscaling is needed.
 */
function makePreviewPixels(source: import('image-js').Image, maxPixels: number): PixelSource | null {
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
	// putImageData needs a concrete ArrayBuffer — srcData already has one
	srcCtx.putImageData(new ImageData(srcData, source.width, source.height), 0, 0);

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
 * Owns a Web Worker and a latest-wins job queue.
 *
 * A resource, not a piece of React state, so it is a class with an explicit
 * lifecycle. `start()` is idempotent and `dispose()` terminates the worker.
 *
 * Latest-wins: submitting a job cancels the callback of any in-flight job, so a
 * slow render can never overwrite a newer one. Callers get a cancel function
 * back for finer-grained control (e.g. on unmount).
 */
export class ImageProcessor {
	#worker: Worker | null = null;
	#jobId = 0;
	#pending = new Map<number, (result: ProcessResult) => void>();

	/** Creates the worker. Safe to call twice; the second call is ignored. */
	start(): void {
		if (this.#worker) return;
		try {
			// Relative URL string so it resolves correctly after bundling.
			const worker = new Worker(new URL('../workers/imageProcessor.worker.ts', import.meta.url), {
				type: 'module',
			});
			worker.onmessage = (e: MessageEvent<ProcessResponse>) => {
				const { jobId, data, width, height } = e.data;
				const cb = this.#pending.get(jobId);
				if (!cb) return; // stale / already-cancelled job
				this.#pending.delete(jobId);
				// Ensure a concrete ArrayBuffer for the ImageData constructor
				const buf = new Uint8ClampedArray(data.buffer.slice(0)) as Uint8ClampedArray<ArrayBuffer>;
				cb({ ok: true, imageData: new ImageData(buf, width, height) });
			};
			worker.onerror = () => {
				// Notify everything still waiting so callers are never left hanging.
				for (const cb of this.#pending.values()) cb({ ok: false });
				this.#pending.clear();
			};
			this.#worker = worker;
		} catch {
			// Worker unavailable — `process` falls back to synchronous handling.
			this.#worker = null;
		}
	}

	dispose(): void {
		this.#worker?.terminate();
		this.#worker = null;
		this.#pending.clear();
	}

	/**
	 * Submits a processing job and returns a cancel function.
	 *
	 * For previews, images above `PREVIEW_MAX_PIXELS` are downscaled first.
	 * Falls back to returning unprocessed pixels when no worker is available.
	 */
	process = (
		source: import('image-js').Image,
		params: ProcessParams,
		isPreview: boolean,
		callback: (result: ProcessResult) => void,
	): (() => void) => {
		// Latest-wins: drop callbacks for anything still in flight.
		this.#pending.clear();

		const jobId = ++this.#jobId;
		const preview = isPreview ? makePreviewPixels(source, UI.PERF.PREVIEW_MAX_PIXELS) : null;
		const pixelSource = preview ?? imageToUint8Clamped(source);

		const worker = this.#worker;
		if (!worker) {
			try {
				const buf = new Uint8ClampedArray(pixelSource.data.buffer.slice(0)) as Uint8ClampedArray<ArrayBuffer>;
				callback({ ok: true, imageData: new ImageData(buf, pixelSource.width, pixelSource.height) });
			} catch {
				callback({ ok: false });
			}
			return () => {};
		}

		// Register before posting, to avoid a response arriving first.
		this.#pending.set(jobId, callback);

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
			// Remove the callback so the response is ignored.
			this.#pending.delete(jobId);
		};
	};
}
