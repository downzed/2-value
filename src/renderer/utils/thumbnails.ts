import type { Image } from 'image-js';
import { UI } from '../constants/ui';

/** Flat [x0, y0, x1, y1, ...] with coordinates normalized to 0..1. */
type Stroke = number[];

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function fitBox(width: number, height: number, maxSize: number) {
	const scale = Math.min(1, maxSize / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
		scale,
	};
}

/**
 * Renders a downscaled preview of a decoded image to a data URL.
 * Returns null when OffscreenCanvas is unavailable (e.g. older Safari, jsdom),
 * so callers can fall back to a text-only preview rather than crash.
 */
export async function renderImageThumbnail(
	image: Image,
	maxSize: number = UI.OPEN_ITEMS.THUMB_SIZE,
): Promise<string | null> {
	if (typeof OffscreenCanvas === 'undefined') return null;
	try {
		const raw = image.getRawImage();
		const { width, height } = fitBox(raw.width, raw.height, maxSize);

		const src = new OffscreenCanvas(raw.width, raw.height);
		const sctx = src.getContext('2d');
		if (!sctx) return null;
		sctx.putImageData(new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height) as ImageData, 0, 0);

		const dst = new OffscreenCanvas(width, height);
		const dctx = dst.getContext('2d');
		if (!dctx) return null;
		dctx.drawImage(src as unknown as CanvasImageSource, 0, 0, width, height);

		return await blobToDataUrl(await dst.convertToBlob({ type: 'image/png' }));
	} catch {
		return null;
	}
}

/**
 * Replays normalized strokes onto a context at the given pixel size.
 * Shared by the hover preview and the export path so both look identical.
 */
export function renderStrokes(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	strokes: Stroke[],
	width: number,
	height: number,
	lineWidth: number,
) {
	ctx.strokeStyle = UI.CANVAS.BRUSH_COLOR;
	ctx.fillStyle = UI.CANVAS.BRUSH_COLOR;
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	for (const stroke of strokes) {
		if (stroke.length === 0) continue;
		// A tap with no drag has no segment — draw it as a dot instead.
		if (stroke.length < 4) {
			ctx.beginPath();
			ctx.arc(stroke[0] * width, stroke[1] * height, lineWidth / 2, 0, Math.PI * 2);
			ctx.fill();
			continue;
		}
		ctx.beginPath();
		ctx.moveTo(stroke[0] * width, stroke[1] * height);
		for (let i = 2; i < stroke.length; i += 2) {
			ctx.lineTo(stroke[i] * width, stroke[i + 1] * height);
		}
		ctx.stroke();
	}
}

/**
 * Renders a blank canvas' strokes to a data URL preview, so hover shows what was
 * drawn rather than an empty white square.
 */
export async function renderStrokesThumbnail(
	strokes: Stroke[],
	canvasWidth: number,
	canvasHeight: number,
	maxSize: number = UI.OPEN_ITEMS.THUMB_SIZE,
): Promise<string | null> {
	if (typeof OffscreenCanvas === 'undefined') return null;
	if (canvasWidth <= 0 || canvasHeight <= 0) return null;
	try {
		const { width, height, scale } = fitBox(canvasWidth, canvasHeight, maxSize);
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		ctx.fillStyle = UI.CANVAS.BACKGROUND;
		ctx.fillRect(0, 0, width, height);
		// Keep the brush visually proportionate at thumbnail scale.
		renderStrokes(ctx, strokes, width, height, Math.max(1, UI.CANVAS.BRUSH_SIZE * scale));

		return await blobToDataUrl(await canvas.convertToBlob({ type: 'image/png' }));
	} catch {
		return null;
	}
}
