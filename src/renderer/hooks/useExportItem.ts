import { useCallback, useRef } from 'react';
import { useGalleryContext } from './GalleryContext';
import { useImageContext } from './ImageContext';
import { useImageProcessingWorker } from './useImageProcessingWorker';
import { saveImageFile } from '../utils/fileOps';
import { renderBlankItemToBlob, renderImageItemToBlob } from '../utils/itemRender';
import type { OpenItem } from './useImage';

/**
 * Rendering and file export for open items.
 *
 * The status bar's Save reads the live preview canvas, but that is only correct
 * for the item currently on screen. Menu-driven Save and Export must work for
 * *any* open item, so they re-render offscreen: filtered pixels for images,
 * replayed strokes for blank canvases. Both share `renderItemToBlob` so they
 * cannot drift apart.
 */
export function useExportItem() {
	const { items, viewport, strokesByItemRef } = useImageContext();
	const { getImageBlob } = useGalleryContext();
	// A private worker so exporting never disturbs the preview pipeline's
	// latest-wins job queue.
	const { process } = useImageProcessingWorker();
	const processRef = useRef(process);
	processRef.current = process;

	const renderItemToBlob = useCallback(
		async (item: OpenItem): Promise<Blob | null> => {
			if (item.kind === 'blank') {
				return renderBlankItemToBlob(
					strokesByItemRef.current.get(item.id) ?? [],
					Math.max(viewport.width, 1),
					Math.max(viewport.height, 1),
				);
			}
			if (!item.image) return null;
			return renderImageItemToBlob(
				item.image,
				{ blur: item.blur, threshold: item.threshold, values: item.values },
				processRef.current,
			);
		},
		[strokesByItemRef, viewport.width, viewport.height],
	);

	const exportOpenItem = useCallback(
		async (item: OpenItem): Promise<void> => {
			const blob = await renderItemToBlob(item);
			if (!blob) throw new Error('Nothing to export');
			await saveImageFile(blob, item.fileName || `${item.label}.png`);
		},
		[renderItemToBlob],
	);

	const exportGalleryImage = useCallback(
		async (galleryImageId: string, fileName: string): Promise<void> => {
			const blob = await getImageBlob(galleryImageId);
			if (!blob) throw new Error('Image blob not found');
			await saveImageFile(blob, fileName || 'image.png');
		},
		[getImageBlob],
	);

	/** Resolve an open item id, throwing if it has since been closed. */
	const requireItem = useCallback(
		(itemId: string): OpenItem => {
			const item = items.find((i) => i.id === itemId);
			if (!item) throw new Error('Open item not found');
			return item;
		},
		[items],
	);

	return { renderItemToBlob, exportOpenItem, exportGalleryImage, requireItem };
}
