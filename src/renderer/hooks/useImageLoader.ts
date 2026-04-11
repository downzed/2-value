import { Image } from 'image-js';
import { useCallback } from 'react';
import { UI } from '../constants/ui';
import { useImageContext } from './ImageContext';

export type ImageLoadError =
	| { code: 'FILE_TOO_LARGE'; fileSize: number; maxBytes: number }
	| { code: 'TOO_MANY_PIXELS'; pixels: number; maxPixels: number }
	| { code: 'DECODE_FAILED'; cause: unknown };

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

export function useImageLoader() {
	const { loadImage } = useImageContext();

	/**
	 * Primary load path: fetch raw bytes from main process, decode in renderer,
	 * apply guardrails, then hand off to useImage.
	 */
	const loadFromPath = useCallback(
		async (filePath: string, fileSize: number): Promise<{ ok: true } | { ok: false; error: ImageLoadError }> => {
			// File-size preflight
			if (fileSize > UI.PERF.MAX_FILE_BYTES) {
				return {
					ok: false,
					error: { code: 'FILE_TOO_LARGE', fileSize, maxBytes: UI.PERF.MAX_FILE_BYTES },
				};
			}

			let bitmap: ImageBitmap | undefined;
			try {
				const bytes = await window.electronAPI.readImageBuffer(filePath);
				const decoded = await decodeBytesToImage(bytes);
				bitmap = decoded.bitmap;
				const image = decoded.image;

				// Pixel-count guardrail
				const pixels = image.width * image.height;
				if (pixels > UI.PERF.MAX_PIXELS) {
					bitmap.close();
					return {
						ok: false,
						error: { code: 'TOO_MANY_PIXELS', pixels, maxPixels: UI.PERF.MAX_PIXELS },
					};
				}

				const fileName = filePath.split(/[/\\]/).pop() ?? 'Untitled';
				await loadImage(image, fileName, filePath);
				bitmap.close();
				return { ok: true };
			} catch (cause) {
				bitmap?.close();
				return { ok: false, error: { code: 'DECODE_FAILED', cause } };
			}
		},
		[loadImage],
	);

	return { loadFromPath };
}

/**
 * Returns a human-readable message for an ImageLoadError.
 */
export function imageLoadErrorMessage(error: ImageLoadError): string {
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
