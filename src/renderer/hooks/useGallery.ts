import { useCallback, useMemo, useRef, useState } from 'react';
import type { GalleryFolder, GalleryImage, ExternalImage, ExternalSearchResult } from '../../shared/types';
import { UI } from '../constants/ui';

export type GalleryTab = 'folders' | 'explore';

/** Deduplicate an array of SourceSplash images by id. */
function dedupeById(imgs: ExternalImage[]): ExternalImage[] {
	const seen = new Set<string>();
	return imgs.filter((img) => {
		if (seen.has(img.id)) return false;
		seen.add(img.id);
		return true;
	});
}

interface GalleryState {
	folders: GalleryFolder[];
	images: GalleryImage[];
	selectedFolderId: string | null;
	gallerySearchQuery: string;
	activeTab: GalleryTab;
	loading: boolean;
	error: string | null;
	suggestions: ExternalImage[];
	suggestionsLoading: boolean;
	searchResults: ExternalSearchResult | null;
	searchResultsLoading: boolean;
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
		suggestions: [],
		suggestionsLoading: false,
		searchResults: null,
		searchResultsLoading: false,
	});

	const {
		folders,
		images,
		selectedFolderId,
		gallerySearchQuery,
		activeTab,
		loading,
		error,
		suggestions,
		suggestionsLoading,
		searchResults,
		searchResultsLoading,
	} = state;

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

	// --- Image operations ---

	const importImage = useCallback(
		async (sourcePath: string, folderId: string) => {
			try {
				setState((prev) => ({ ...prev, error: null }));
				const img = await window.electronAPI.galleryImportImage(sourcePath, folderId);
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
				await window.electronAPI.galleryMoveImage(imageId, targetFolderId);
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
				await window.electronAPI.galleryCopyImage(imageId, targetFolderId);
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
				await window.electronAPI.galleryDeleteImage(imageId);
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
		async (imageId: string): Promise<{ path: string; fileName: string; fileSize: number }> => {
			setState((prev) => ({ ...prev, error: null }));
			return window.electronAPI.galleryOpenImage(imageId);
		},
		[],
	);

	// --- SourceSplash actions ---

	/**
	 * Load suggestions for a folder (uses /api/random with folder name + tags as query).
	 * Caches results in state for `UI.GALLERY.CACHE_TTL_MS` milliseconds.
	 */
	const suggestionsCache = useRef<{ query: string; fetchedAt: number; images: ExternalImage[] } | null>(null);

	const loadSuggestions = useCallback(async (folderName: string, tags: string[], force = false) => {
		const query = [folderName, ...tags].filter(Boolean).join(' ');

		// Use cache unless forced or stale
		if (!force && suggestionsCache.current && suggestionsCache.current.query === query) {
			const age = Date.now() - suggestionsCache.current.fetchedAt;
			if (age < UI.GALLERY.CACHE_TTL_MS) {
				setState((prev) => ({
					...prev,
					suggestions: suggestionsCache.current?.images ?? [],
					suggestionsLoading: false,
				}));
				return;
			}
		}

		setState((prev) => ({ ...prev, suggestionsLoading: true }));
		try {
			const raw = await window.electronAPI.galleryRandomImages(query || undefined, UI.GALLERY.SUGGESTION_COUNT);
			const images = dedupeById(raw);
			suggestionsCache.current = { query, fetchedAt: Date.now(), images };
			setState((prev) => ({ ...prev, suggestions: images, suggestionsLoading: false }));
		} catch {
			// Silently clear loading — suggestions are best-effort
			setState((prev) => ({ ...prev, suggestionsLoading: false }));
		}
	}, []);

	const clearSuggestions = useCallback(() => {
		suggestionsCache.current = null;
		setState((prev) => ({ ...prev, suggestions: [] }));
	}, []);

	// Explore tab search — cache by page
	const searchCache = useRef<Map<string, { result: ExternalSearchResult; fetchedAt: number }>>(new Map());
	const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min per plan

	const searchExplore = useCallback(async (query: string, page = 1) => {
		const cacheKey = `${query.trim().toLowerCase()}:${page}`;
		const cached = searchCache.current.get(cacheKey);
		if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_TTL_MS) {
			setState((prev) => ({ ...prev, searchResults: cached.result, searchResultsLoading: false }));
			return;
		}

		setState((prev) => ({ ...prev, searchResultsLoading: true }));
		try {
			const result = await window.electronAPI.gallerySearchImages(query, page);
			searchCache.current.set(cacheKey, { result, fetchedAt: Date.now() });
			setState((prev) => ({
				...prev,
				searchResults:
					page === 1
						? result
						: prev.searchResults
							? { ...result, images: [...prev.searchResults.images, ...result.images] }
							: result,
				searchResultsLoading: false,
			}));
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Search failed.';
			setState((prev) => ({ ...prev, error: msg, searchResultsLoading: false }));
		}
	}, []);

	const clearSearchResults = useCallback(() => {
		searchCache.current.clear();
		setState((prev) => ({ ...prev, searchResults: null }));
	}, []);

	const downloadExternal = useCallback(
		async (
			url: string,
			folderId: string,
			metadata: { sourceId: string; author: string; authorUrl: string; description: string },
		) => {
			try {
				const img = await window.electronAPI.galleryDownloadExternal(url, folderId, metadata);
				await loadGallery();
				return img;
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Download failed.';
				setState((prev) => ({ ...prev, error: msg }));
				throw err;
			}
		},
		[loadGallery],
	);

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
		suggestions,
		suggestionsLoading,
		searchResults,
		searchResultsLoading,
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
		downloadExternal,
		loadSuggestions,
		clearSuggestions,
		searchExplore,
		clearSearchResults,
		setSelectedFolder,
		setGallerySearchQuery,
		setActiveTab,
		clearError,
	};
};
