/**
 * Image processor web worker.
 *
 * Receives raw RGBA pixel data + processing params, performs heavy
 * transforms off the main thread, and returns a processed ImageData.
 *
 * Uses typed-array operations throughout to avoid per-pixel function
 * call overhead from image-js getValueByIndex / setValueByIndex.
 */

export interface ProcessRequest {
	jobId: number;
	/** Raw RGBA Uint8ClampedArray transferred from the source image */
	data: Uint8ClampedArray<ArrayBuffer>;
	width: number;
	height: number;
	blur: number;
	threshold: number;
	values: 2 | 3;
	threeZoneBoundary: number;
}

export interface ProcessResponse {
	jobId: number;
	data: Uint8ClampedArray<ArrayBuffer>;
	width: number;
	height: number;
}

// ---------------------------------------------------------------------------
// Gaussian kernel helpers
// ---------------------------------------------------------------------------

function buildGaussianKernel(sigma: number): { kernel: Float32Array; radius: number } {
	const radius = Math.ceil(sigma * 3);
	const size = 2 * radius + 1;
	const kernel = new Float32Array(size);
	let sum = 0;
	for (let i = 0; i < size; i++) {
		const x = i - radius;
		kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
		sum += kernel[i];
	}
	for (let i = 0; i < size; i++) kernel[i] /= sum;
	return { kernel, radius };
}

/**
 * Separable Gaussian blur on a greyscale (single-channel) buffer.
 * The buffer is an interleaved RGBA array but we only blur the R channel
 * since we've already converted to greyscale (R=G=B).
 */
function gaussianBlurGreyscaleRGBA(
	src: Uint8ClampedArray,
	width: number,
	height: number,
	sigma: number,
): Uint8ClampedArray {
	const { kernel, radius } = buildGaussianKernel(sigma);
	const temp = new Float32Array(width * height);
	const dst = new Uint8ClampedArray(src.length);

	// Horizontal pass: read R channel, write to temp
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let val = 0;
			for (let k = -radius; k <= radius; k++) {
				const sx = Math.min(width - 1, Math.max(0, x + k));
				val += src[(y * width + sx) * 4] * kernel[k + radius];
			}
			temp[y * width + x] = val;
		}
	}

	// Vertical pass: read temp, write to dst RGBA
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let val = 0;
			for (let k = -radius; k <= radius; k++) {
				const sy = Math.min(height - 1, Math.max(0, y + k));
				val += temp[sy * width + x] * kernel[k + radius];
			}
			const v = Math.round(val);
			const i = (y * width + x) * 4;
			dst[i] = v;
			dst[i + 1] = v;
			dst[i + 2] = v;
			dst[i + 3] = 255;
		}
	}

	return dst;
}

// ---------------------------------------------------------------------------
// Processing pipeline (typed-array, no image-js)
// ---------------------------------------------------------------------------

function processPixels(req: ProcessRequest): Uint8ClampedArray<ArrayBuffer> {
	const { blur, threshold, values, threeZoneBoundary, width, height } = req;
	let data: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(req.data) as Uint8ClampedArray<ArrayBuffer>;

	const pixelCount = width * height;
	const needsGrey = threshold > 0 || values === 3;

	// --- Step 1: greyscale (luma709) ---
	if (needsGrey) {
		for (let i = 0; i < pixelCount; i++) {
			const p = i * 4;
			const luma = Math.round(data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722);
			data[p] = luma;
			data[p + 1] = luma;
			data[p + 2] = luma;
			// alpha unchanged
		}
	}

	// --- Step 2: Gaussian blur ---
	if (blur > 0) {
		data = gaussianBlurGreyscaleRGBA(data, width, height, blur) as Uint8ClampedArray<ArrayBuffer>;
	}

	// --- Step 3: threshold ---
	if (threshold > 0) {
		if (values === 3) {
			const lower = Math.max(0, threshold - threeZoneBoundary);
			const upper = Math.min(255, threshold + threeZoneBoundary);
			for (let i = 0; i < pixelCount; i++) {
				const p = i * 4;
				const v = data[p]; // greyscale — R=G=B
				const out = v < lower ? 0 : v > upper ? 255 : 128;
				data[p] = out;
				data[p + 1] = out;
				data[p + 2] = out;
			}
		} else {
			const thresh = threshold; // 0-255
			for (let i = 0; i < pixelCount; i++) {
				const p = i * 4;
				const out = data[p] >= thresh ? 255 : 0;
				data[p] = out;
				data[p + 1] = out;
				data[p + 2] = out;
			}
		}
	}

	return data;
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent<ProcessRequest>) => {
	const req = e.data;
	try {
		const processed = processPixels(req);
		// Transfer the buffer back to avoid copying
		const resp: ProcessResponse = {
			jobId: req.jobId,
			data: processed,
			width: req.width,
			height: req.height,
		};
		(self as unknown as Worker).postMessage(resp, [processed.buffer as ArrayBuffer]);
	} catch (_err) {
		// On error, echo back the original data so canvas can still render
		const resp: ProcessResponse = {
			jobId: req.jobId,
			data: req.data,
			width: req.width,
			height: req.height,
		};
		(self as unknown as Worker).postMessage(resp);
	}
};
