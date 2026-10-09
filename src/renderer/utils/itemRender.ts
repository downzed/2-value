import type { Image } from 'image-js';
import { UI } from '../constants/ui';
import type { ProcessParams } from '../core/ImageProcessor';
import { renderStrokes } from './thumbnails';

const PNG = 'image/png';

/**
 * Renders any open item to a PNG blob, offscreen.
 *
 * Returns null when rendering is unavailable (no `OffscreenCanvas`, e.g. older
 * Safari, or jsdom) rather than throwing, matching `utils/thumbnails.ts`.
 *
 * The status bar's Save reads the live preview canvas, which is only correct for
 * the item currently on screen. Export needs to work for *any* open item, so the
 * content is reproduced here: filtered pixels for images, replayed strokes for
 * blank canvases.
 */
export async function renderImageItemToBlob(
	image: Image,
	params: ProcessParams,
	process: (
		source: Image,
		params: ProcessParams,
		isPreview: boolean,
		callback: (result: { ok: true; imageData: ImageData } | { ok: false }) => void,
	) => () => void,
): Promise<Blob | null> {
	if (typeof OffscreenCanvas === 'undefined') return null;

	const imageData = await new Promise<ImageData | null>((resolve) => {
		process(image, params, false, (result) => resolve(result.ok ? result.imageData : null));
	});
	if (!imageData) return null;

	const canvas = new OffscreenCanvas(imageData.width, imageData.height);
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.putImageData(imageData, 0, 0);
	return canvas.convertToBlob({ type: PNG });
}

export async function renderBlankItemToBlob(strokes: number[][], width: number, height: number): Promise<Blob | null> {
	if (width <= 0 || height <= 0) return null;
	if (typeof OffscreenCanvas === 'undefined') return null;

	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	renderStrokes(ctx, strokes, width, height, UI.CANVAS.BRUSH_SIZE);
	return canvas.convertToBlob({ type: PNG });
}
