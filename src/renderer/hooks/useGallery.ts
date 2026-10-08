import { useMemo, useSyncExternalStore } from 'react';
import { GalleryStore } from '../core/GalleryStore';
import { galleryRepository } from '../utils/storage';

/**
 * React binding for {@link GalleryStore}.
 *
 * Deliberately behaviour-preserving: it subscribes to the whole snapshot, so
 * every gallery consumer still re-renders on any gallery change. Phase 4 swaps
 * this for field-level selectors.
 */
/** @param injected Optional store; see {@link useImage}. */
export function useGallery(injected?: GalleryStore) {
	const local = useMemo(() => (injected ? null : new GalleryStore(galleryRepository)), [injected]);
	const store = injected ?? (local as GalleryStore);
	const state = useSyncExternalStore(store.subscribe, store.getState);

	return {
		folders: state.folders,
		images: state.images,
		filteredImages: store.filteredImages,
		selectedFolderId: state.selectedFolderId,
		gallerySearchQuery: state.gallerySearchQuery,
		loading: state.loading,
		error: state.error,
		loadGallery: store.loadGallery,
		createFolder: store.createFolder,
		renameFolder: store.renameFolder,
		deleteFolder: store.deleteFolder,
		updateFolderTags: store.updateFolderTags,
		importImage: store.importImage,
		saveImageToGallery: store.saveImageToGallery,
		moveImage: store.moveImage,
		copyImage: store.copyImage,
		deleteImage: store.deleteImage,
		openGalleryImage: store.openGalleryImage,
		getImageBlob: store.getImageBlob,
		setSelectedFolder: store.setSelectedFolder,
		setGallerySearchQuery: store.setGallerySearchQuery,
		clearError: store.clearError,
	};
}

export type { GalleryState, OpenImageResult } from '../core/GalleryStore';
export type GalleryContextValue = ReturnType<typeof useGallery>;
