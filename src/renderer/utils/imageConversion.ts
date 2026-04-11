import type { Image } from 'image-js';

/**
 * Convert an image-js Image to an ImageData object using getRawImage().
 * Ensures a concrete ArrayBuffer (not SharedArrayBuffer) for canvas and transfer.
 */
export function imageToImageData(source: Image): ImageData {
	const raw = source.getRawImage();
	const clamped = new Uint8ClampedArray(raw.data.length) as Uint8ClampedArray<ArrayBuffer>;
	clamped.set(raw.data);
	return new ImageData(clamped, raw.width, raw.height);
}

/**
 * Extract raw pixel data from an image-js Image as a Uint8ClampedArray.
 * Ensures a concrete ArrayBuffer (not SharedArrayBuffer) for worker transfer.
 */
export function imageToUint8Clamped(source: Image): {
	data: Uint8ClampedArray<ArrayBuffer>;
	width: number;
	height: number;
} {
	const raw = source.getRawImage();
	const clamped = new Uint8ClampedArray(raw.data.length) as Uint8ClampedArray<ArrayBuffer>;
	clamped.set(raw.data);
	return { data: clamped, width: raw.width, height: raw.height };
}
