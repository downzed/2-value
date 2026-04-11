import { useCallback, useMemo, useRef, useState } from 'react';
import type { GalleryFolder, GalleryImage } from '../../shared/types';

export type GalleryTab = 'folders' | 'explore';

interface GalleryState {
	folders: GalleryFolder[];
	images: GalleryImage[];
	selectedFolderId: string | null;
	gallerySearchQuery: string;
	activeTab: GalleryTab;
	loading: boolean;
	error: string | null;
}

export const useGallery = () => {
	const [state, setState] = useState<GalleryState>({
		folders: [],
		images: [],
		selectedFolderId: null,
		gallerySearchQuery: '',
		activeTab: 'folders',
		loading: false,
		error: null,
	});

	const { folders, images, selectedFolderId, gallerySearchQuery, activeTab, loading, error } = state;

	// Monotonically-increasing generation counter; each load increments it and
	// only applies results if the counter hasn't advanced since the call started.
	const loadGenRef = useRef(0);

	const loadGallery = useCallback(async () => {
		loadGenRef.current += 1;
		const gen = loadGenRef.current;
		try {
			setState((prev) => ({ ...prev, loading: true, error: null }));
			const data = await window.electronAPI.galleryGetData();
			// Discard stale responses from earlier concurrent calls
			if (gen !== loadGenRef.current) return;
			setState((prev) => ({ ...prev, folders: data.folders, images: data.images, loading: false }));
		} catch {
			if (gen !== loadGenRef.current) return;
			setState((prev) => ({ ...prev, error: 'Failed to load gallery.', loading: false }));
		}
	}, []);

	const createFolder = useCallback(
		async (name: string, tags?: string[]) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				await window.electronAPI.galleryCreateFolder(name, tags);
				await loadGallery();
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to create folder.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const renameFolder = useCallback(
		async (folderId: string, newName: string) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				await window.electronAPI.galleryRenameFolder(folderId, newName);
				await loadGallery();
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to rename folder.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const deleteFolder = useCallback(
		async (folderId: string, deleteImages: boolean) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				await window.electronAPI.galleryDeleteFolder(folderId, deleteImages);
				setState((prev) => ({
					...prev,
					selectedFolderId: prev.selectedFolderId === folderId ? null : prev.selectedFolderId,
				}));
				await loadGallery();
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to delete folder.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const updateFolderTags = useCallback(
		async (folderId: string, tags: string[]) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				await window.electronAPI.galleryUpdateFolderTags(folderId, tags);
				await loadGallery();
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to update folder tags.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const setSelectedFolder = useCallback((folderId: string | null) => {
		setState((prev) => ({ ...prev, selectedFolderId: folderId }));
	}, []);

	const setGallerySearchQuery = useCallback((query: string) => {
		setState((prev) => ({ ...prev, gallerySearchQuery: query }));
	}, []);

	const setActiveTab = useCallback((tab: GalleryTab) => {
		setState((prev) => ({ ...prev, activeTab: tab }));
	}, []);

	const clearError = useCallback(() => {
		setState((prev) => ({ ...prev, error: null }));
	}, []);

	// Client-side filter: search images by fileName (case-insensitive substring).
	// Memoised to avoid re-filtering on every render (e.g. when dialog state changes).
	const filteredImages = useMemo(() => {
		const q = gallerySearchQuery.trim().toLowerCase();
		if (!q) return images;
		return images.filter((img) => img.fileName.toLowerCase().includes(q));
	}, [images, gallerySearchQuery]);

	return {
		folders,
		images,
		filteredImages,
		selectedFolderId,
		gallerySearchQuery,
		activeTab,
		loading,
		error,
		loadGallery,
		createFolder,
		renameFolder,
		deleteFolder,
		updateFolderTags,
		setSelectedFolder,
		setGallerySearchQuery,
		setActiveTab,
		clearError,
	};
};
