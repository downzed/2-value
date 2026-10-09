import { useEffect, useRef, useState } from 'react';
import type { GalleryImage } from '../../shared/types';

/**
 * Object URLs for gallery thumbnails, keyed by image id.
 *
 * Each URL has to be revoked exactly once, and the bookkeeping is fiddly enough
 * to be worth isolating: only newly-seen images are fetched, and images that
 * disappear from `images` have their URLs revoked through a functional state
 * update so the revoke cannot be lost to a stale closure.
 *
 * In-flight fetches are cancelled on cleanup, and any URL they had already
 * created is revoked there rather than being committed to state.
 */
export function useThumbnailUrls(
	images: GalleryImage[],
	getThumbnailBlob: (imageId: string) => Promise<Blob | undefined>,
): Record<string, string> {
	const [urls, setUrls] = useState<Record<string, string>>({});
	const prevImageIdsRef = useRef<string[]>([]);

	useEffect(() => {
		const prevIds = new Set(prevImageIdsRef.current);
		const newImages = images.filter((i) => !prevIds.has(i.id));
		const removedIds = prevImageIdsRef.current.filter((id) => !images.some((i) => i.id === id));

		// Revoke URLs for removed images via functional state update
		if (removedIds.length > 0) {
			setUrls((prev) => {
				const next = { ...prev };
				for (const id of removedIds) {
					if (next[id]) {
						URL.revokeObjectURL(next[id]);
						delete next[id];
					}
				}
				return next;
			});
		}

		if (newImages.length === 0) return;

		let cancelled = false;
		const newUrls: Record<string, string> = {};

		Promise.all(
			newImages.map(async (img) => {
				try {
					const blob = await getThumbnailBlob(img.id);
					if (blob && !cancelled) {
						newUrls[img.id] = URL.createObjectURL(blob);
					}
				} catch {
					// thumbnail unavailable
				}
			}),
		).then(() => {
			if (!cancelled) {
				prevImageIdsRef.current = images.map((i) => i.id);
				setUrls((prev) => ({ ...prev, ...newUrls }));
			}
		});

		return () => {
			cancelled = true;
			for (const url of Object.values(newUrls)) {
				URL.revokeObjectURL(url);
			}
		};
	}, [images, getThumbnailBlob]);

	return urls;
}
