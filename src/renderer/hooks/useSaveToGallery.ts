import { useCallback } from 'react';
import { useGalleryContext } from './GalleryContext';
import { useImageContext } from './ImageContext';

/**
 * Saves the active item's pixels into the gallery.
 *
 * Overwrites the item's existing gallery entry when it has one (so repeated
 * saves keep updating a single entry), otherwise creates a new entry in
 * `Unsorted` and relinks the item to it, which also makes it restorable.
 */
export function useSaveToGallery() {
	const { activeItemId, items, linkGalleryImage, markActiveSaved } = useImageContext();
	const { saveImageToGallery } = useGalleryContext();

	return useCallback(
		async (blob: Blob, fileName: string): Promise<void> => {
			if (activeItemId === null) return;
			const item = items.find((i) => i.id === activeItemId);
			if (!item) return;

			const galleryImageId = await saveImageToGallery(blob, fileName, item.galleryImageId);
			linkGalleryImage(activeItemId, galleryImageId);
			markActiveSaved();
		},
		[activeItemId, items, saveImageToGallery, linkGalleryImage, markActiveSaved],
	);
}
