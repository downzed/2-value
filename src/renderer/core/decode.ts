import { Image } from 'image-js';
import { UI } from '../constants/ui';
import type { DecodeError, DecodeResult } from './types';

/**
 * Decode a Uint8Array of raw image bytes into an image-js Image via
 * createImageBitmap (avoids base64 inflation entirely).
 */
async function decodeBytesToImage(bytes: Uint8Array): Promise<{ image: Image; bitmap: ImageBitmap }> {
	// Ensure we have a concrete ArrayBuffer (not SharedArrayBuffer) for Blob
	const buf: ArrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
	const blob = new Blob([buf]);
	const bitmap = await createImageBitmap(blob);

	// Draw bitmap onto an offscreen canvas so we can extract ImageData
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not get 2d context from OffscreenCanvas');
	ctx.drawImage(bitmap, 0, 0);
	const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

	// Build image-js Image from raw RGBA pixel data
	const data = new Uint8ClampedArray(imageData.data.buffer.slice(0)) as unknown as Uint8Array;
	const image = new Image(bitmap.width, bitmap.height, {
		data,
		colorModel: 'RGBA',
	});
	return { image, bitmap };
}

/**
 * Decodes a user-supplied file into an image-js Image, enforcing the size
 * limits. Pure: it touches no store and no React state, so it is trivially
 * testable and reusable. Always closes the bitmap it created.
 */
export async function decodeImageFile(file: File): Promise<DecodeResult> {
	if (file.size > UI.PERF.MAX_FILE_BYTES) {
		return {
			ok: false,
			error: { code: 'FILE_TOO_LARGE', fileSize: file.size, maxBytes: UI.PERF.MAX_FILE_BYTES },
		};
	}

	let bitmap: ImageBitmap | undefined;
	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const decoded = await decodeBytesToImage(bytes);
		bitmap = decoded.bitmap;

		const pixels = decoded.image.width * decoded.image.height;
		if (pixels > UI.PERF.MAX_PIXELS) {
			return {
				ok: false,
				error: { code: 'TOO_MANY_PIXELS', pixels, maxPixels: UI.PERF.MAX_PIXELS },
			};
		}

		return { ok: true, image: decoded.image };
	} catch (cause) {
		return { ok: false, error: { code: 'DECODE_FAILED', cause } };
	} finally {
		// Must not leak on the early return above.
		bitmap?.close();
	}
}

/** Returns a human-readable message for a DecodeError. */
export function decodeErrorMessage(error: DecodeError): string {
	switch (error.code) {
		case 'FILE_TOO_LARGE': {
			const mb = Math.round(error.maxBytes / (1024 * 1024));
			return `File is too large to open (limit: ${mb} MB).`;
		}
		case 'TOO_MANY_PIXELS':
			return 'Image is too large to process safely on this machine.';
		case 'DECODE_FAILED':
			return 'Failed to decode the image file.';
	}
}
