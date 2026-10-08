import { useEffect, useRef, useState } from 'react';
import { useGalleryContext } from './GalleryContext';
import { useImageContext } from './ImageContext';
import { useImageLoader } from './useImageLoader';
import { galleryStore } from '../utils/storage';

const STORAGE_KEY = 'image-editor-open-items';

function readPersistedIds(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
	} catch {
		return [];
	}
}

/**
 * Restores the open-items list across reloads.
 *
 * Only gallery-backed items are restorable — we hold their blobs in IndexedDB,
 * whereas a file opened from disk cannot be re-read without user permission,
 * and blank canvases have no bytes at all.
 */
export function useRestoreOpenItems() {
	const { loading, images, openGalleryImage } = useGalleryContext();
	const { restorableItemIds } = useImageContext();
	const { loadFromFile } = useImageLoader();

	/**
	 * Snapshot the persisted ids during the first render. Reading them in an
	 * effect would be too late: the persist effect below runs first and would
	 * overwrite the saved list with the current (empty) one.
	 */
	const pendingIdsRef = useRef<string[] | null>(null);
	if (pendingIdsRef.current === null) pendingIdsRef.current = readPersistedIds();

	// Persisting is held off until restoration finishes, otherwise the first
	// paint would rewrite the saved list before it had a chance to be read.
	const [restored, setRestored] = useState(false);

	useEffect(() => {
		if (!restored) return;
		try {
			// Dirty items are already excluded from restorableItemIds, so this
			// also prunes anything that gained unsaved changes since last time.
			localStorage.setItem(STORAGE_KEY, JSON.stringify(restorableItemIds));
		} catch {
			// Storage unavailable (private mode / quota) — session-only is fine.
		}
	}, [restored, restorableItemIds]);

	useEffect(() => {
		if (restored) return;
		// Wait for the gallery so persisted ids can be resolved to real entries.
		if (loading || images.length === 0) return;

		const wanted = pendingIdsRef.current ?? [];
		pendingIdsRef.current = null;
		setRestored(true);
		if (wanted.length === 0) return;

		void (async () => {
			for (const galleryImageId of wanted) {
				try {
					const { blob, fileName } = await openGalleryImage(galleryImageId);
					const thumbUrl = await galleryStore
						.getThumbnailBlob(galleryImageId)
						.then((b) => (b ? URL.createObjectURL(b) : null));
					await loadFromFile(new File([blob], fileName), { galleryImageId, thumbUrl });
				} catch (error) {
					// Entry deleted or unreadable since the last session — skip it.
					console.warn('Could not restore open item', galleryImageId, error);
				}
			}
		})();
	}, [restored, loading, images, openGalleryImage, loadFromFile]);
}
