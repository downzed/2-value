import { useCallback } from 'react';
import { decodeImageFile } from '../core/decode';
import type { DecodeError, DecodeResult, OpenImageMeta } from '../core/types';
import { useImageContext } from './ImageContext';

export { decodeErrorMessage as imageLoadErrorMessage } from '../core/decode';
export type { DecodeResult };

/** Kept as an alias so existing call sites and tests keep their names. */
export type ImageLoadError = DecodeError;

export type LoadFromFileResult = { ok: true } | Extract<DecodeResult, { ok: false }>;

/**
 * Thin binding that decodes a user-supplied file and opens it as an item.
 *
 * All the real work lives in `core/decode.ts` (pure) and `EditorStore`; this
 * exists only to keep the existing call sites working until Phase 4.
 */
export function useImageLoader() {
	const { loadImage } = useImageContext();

	const loadFromFile = useCallback(
		async (file: File, meta: OpenImageMeta = {}): Promise<LoadFromFileResult> => {
			const result = await decodeImageFile(file);
			if (!result.ok) return result;
			await loadImage(result.image, file.name, meta);
			return { ok: true };
		},
		[loadImage],
	);

	return { loadFromFile };
}
