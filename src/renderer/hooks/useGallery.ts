import { useCallback, useMemo, useRef, useState } from 'react';
import type { GalleryFolder, GalleryImage } from '../../shared/types';
import { galleryStore } from '../utils/storage';

interface GalleryState {
	folders: GalleryFolder[];
	images: GalleryImage[];
	selectedFolderId: string | null;
	gallerySearchQuery: string;
	loading: boolean;
	error: string | null;
}

export interface OpenImageResult {
	blob: Blob;
	fileName: string;
	fileSize: number;
}

export const useGallery = () => {
	const [state, setState] = useState<GalleryState>({
		folders: [],
		images: [],
		selectedFolderId: null,
		gallerySearchQuery: '',
		loading: false,
		error: null,
	});

	const { folders, images, selectedFolderId, gallerySearchQuery, loading, error } = state;

	const loadGenRef = useRef(0);

	const loadGallery = useCallback(async () => {
		loadGenRef.current += 1;
		const gen = loadGenRef.current;
		try {
			setState((prev) => ({ ...prev, loading: true, error: null }));
			const data = await galleryStore.getData();
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
				await galleryStore.createFolder(name, tags);
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
				await galleryStore.renameFolder(folderId, newName);
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
				await galleryStore.deleteFolder(folderId, deleteImages);
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
				await galleryStore.updateFolderTags(folderId, tags);
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

	const clearError = useCallback(() => {
		setState((prev) => ({ ...prev, error: null }));
	}, []);

	const importImage = useCallback(
		async (file: File, folderId: string) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				const img = await galleryStore.importImage(file, folderId);
				await loadGallery();
				return img;
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to import image.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const moveImage = useCallback(
		async (imageId: string, targetFolderId: string) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				await galleryStore.moveImage(imageId, targetFolderId);
				await loadGallery();
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to move image.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const copyImage = useCallback(
		async (imageId: string, targetFolderId: string) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				await galleryStore.copyImage(imageId, targetFolderId);
				await loadGallery();
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to copy image.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const deleteImage = useCallback(
		async (imageId: string) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				await galleryStore.deleteImage(imageId);
				await loadGallery();
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to delete image.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

	const openGalleryImage = useCallback(
		async (imageId: string): Promise<OpenImageResult> => {
			setState((prev) => ({ ...prev, error: null }));
			const blob = await galleryStore.getImageBlob(imageId);
			if (!blob) throw new Error('Image blob not found');
			const img = images.find((i) => i.id === imageId);
			return {
				blob,
				fileName: img?.fileName ?? 'Unknown',
				fileSize: img?.fileSize ?? blob.size,
			};
		},
		[images],
	);

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
		loading,
		error,
		loadGallery,
		createFolder,
		renameFolder,
		deleteFolder,
		updateFolderTags,
		importImage,
		moveImage,
		copyImage,
		deleteImage,
		openGalleryImage,
		setSelectedFolder,
		setGallerySearchQuery,
		clearError,
	};
};
