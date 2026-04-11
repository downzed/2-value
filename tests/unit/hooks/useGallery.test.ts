import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useGallery } from '../../../src/renderer/hooks/useGallery';
import type { GalleryImage } from '../../../src/shared/types';

// ---------------------------------------------------------------------------
// Minimal mock for window.electronAPI
// ---------------------------------------------------------------------------

const makeImage = (id: string, fileName: string, folderId = 'f1'): GalleryImage => ({
	id,
	folderId,
	fileName,
	originalPath: `/tmp/${fileName}`,
	storedFileName: fileName,
	thumbnailFileName: `${id}.thumb.jpg`,
	width: 100,
	height: 100,
	fileSize: 1024,
	addedAt: Date.now(),
	source: 'local',
});

const mockGetData = vi.fn();
const mockCreateFolder = vi.fn();

const MOCK_API = {
	galleryGetData: mockGetData,
	galleryCreateFolder: mockCreateFolder,
	galleryRenameFolder: vi.fn(),
	galleryDeleteFolder: vi.fn(),
	galleryUpdateFolderTags: vi.fn(),
	galleryReorderFolders: vi.fn(),
	galleryImportImage: vi.fn(),
	galleryMoveImage: vi.fn(),
	galleryCopyImage: vi.fn(),
	galleryDeleteImage: vi.fn(),
	galleryOpenImage: vi.fn(),
	galleryDownloadExternal: vi.fn(),
	gallerySearchImages: vi.fn(),
	galleryRandomImages: vi.fn(),
	openImage: vi.fn(),
	getImageInfo: vi.fn(),
	readImageBuffer: vi.fn(),
	saveImage: vi.fn(),
	getRecents: vi.fn(),
	removeRecent: vi.fn(),
	openImageFromPath: vi.fn(),
};

beforeEach(() => {
	vi.clearAllMocks();
	Object.defineProperty(window, 'electronAPI', { value: MOCK_API, writable: true, configurable: true });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('useGallery – initial state', () => {
	it('starts with empty folders and images', () => {
		const { result } = renderHook(() => useGallery());
		expect(result.current.folders).toEqual([]);
		expect(result.current.images).toEqual([]);
		expect(result.current.filteredImages).toEqual([]);
		expect(result.current.gallerySearchQuery).toBe('');
		expect(result.current.activeTab).toBe('folders');
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBe(null);
	});
});

// ---------------------------------------------------------------------------
// filteredImages – case-insensitive substring search
// ---------------------------------------------------------------------------

describe('useGallery – filteredImages', () => {
	const images = [
		makeImage('1', 'Sunset.jpg'),
		makeImage('2', 'sunrise.png'),
		makeImage('3', 'city-night.jpg'),
		makeImage('4', 'SUNBURN.jpg'),
	];

	async function setupWithImages() {
		mockGetData.mockResolvedValueOnce({ folders: [], images });
		const hook = renderHook(() => useGallery());
		await act(async () => {
			await hook.result.current.loadGallery();
		});
		return hook;
	}

	it('returns all images when query is empty', async () => {
		const { result } = await setupWithImages();
		expect(result.current.filteredImages).toHaveLength(4);
	});

	it('returns all images when query is whitespace only', async () => {
		const { result } = await setupWithImages();
		act(() => result.current.setGallerySearchQuery('   '));
		expect(result.current.filteredImages).toHaveLength(4);
	});

	it('filters case-insensitively by substring', async () => {
		const { result } = await setupWithImages();
		act(() => result.current.setGallerySearchQuery('sun'));
		const names = result.current.filteredImages.map((i) => i.fileName);
		expect(names).toContain('Sunset.jpg');
		expect(names).toContain('sunrise.png');
		expect(names).toContain('SUNBURN.jpg');
		expect(names).not.toContain('city-night.jpg');
	});

	it('is case-insensitive for uppercase query', async () => {
		const { result } = await setupWithImages();
		act(() => result.current.setGallerySearchQuery('SUN'));
		expect(result.current.filteredImages).toHaveLength(3);
	});

	it('returns empty array when no images match', async () => {
		const { result } = await setupWithImages();
		act(() => result.current.setGallerySearchQuery('xyznotfound'));
		expect(result.current.filteredImages).toHaveLength(0);
	});

	it('trims leading/trailing whitespace from query', async () => {
		const { result } = await setupWithImages();
		act(() => result.current.setGallerySearchQuery('  city  '));
		const names = result.current.filteredImages.map((i) => i.fileName);
		expect(names).toContain('city-night.jpg');
		expect(result.current.filteredImages).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// loadGallery – success and error paths
// ---------------------------------------------------------------------------

describe('useGallery – loadGallery', () => {
	it('sets loading=true while request is in-flight and false after', async () => {
		let resolve: (v: unknown) => void = () => {};
		mockGetData.mockReturnValueOnce(new Promise((r) => (resolve = r)));
		const { result } = renderHook(() => useGallery());

		// Start the load but don't await yet
		let loadPromise: Promise<void>;
		act(() => {
			loadPromise = result.current.loadGallery();
		});
		// After act flushes the initial setState, loading should be true
		expect(result.current.loading).toBe(true);

		// Resolve and await completion
		await act(async () => {
			resolve({ folders: [], images: [] });
			await loadPromise;
		});
		expect(result.current.loading).toBe(false);
	});

	it('stores folders and images from the API response', async () => {
		const folders = [{ id: 'f1', name: 'Nature', tags: [], createdAt: 0, sortOrder: 0 }];
		const images = [makeImage('1', 'tree.jpg', 'f1')];
		mockGetData.mockResolvedValueOnce({ folders, images });
		const { result } = renderHook(() => useGallery());

		await act(async () => {
			await result.current.loadGallery();
		});

		expect(result.current.folders).toEqual(folders);
		expect(result.current.images).toEqual(images);
		expect(result.current.error).toBe(null);
	});

	it('sets error string on failure', async () => {
		mockGetData.mockRejectedValueOnce(new Error('network'));
		const { result } = renderHook(() => useGallery());

		await act(async () => {
			await result.current.loadGallery();
		});

		expect(result.current.error).toBe('Failed to load gallery.');
		expect(result.current.loading).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// createFolder – optimistic error propagation
// ---------------------------------------------------------------------------

describe('useGallery – createFolder', () => {
	it('re-throws and sets error when IPC fails', async () => {
		mockCreateFolder.mockRejectedValueOnce(new Error('duplicate name'));
		mockGetData.mockResolvedValue({ folders: [], images: [] });

		const { result } = renderHook(() => useGallery());
		await act(async () => {
			await result.current.loadGallery();
		});

		let threw = false;
		await act(async () => {
			try {
				await result.current.createFolder('duplicate name');
			} catch {
				threw = true;
			}
		});

		expect(threw).toBe(true);
		expect(result.current.error).toBe('duplicate name');
	});
});

// ---------------------------------------------------------------------------
// clearError
// ---------------------------------------------------------------------------

describe('useGallery – clearError', () => {
	it('resets error to null', async () => {
		mockGetData.mockRejectedValueOnce(new Error('boom'));
		const { result } = renderHook(() => useGallery());
		await act(async () => {
			await result.current.loadGallery();
		});
		expect(result.current.error).not.toBe(null);

		act(() => result.current.clearError());
		expect(result.current.error).toBe(null);
	});
});
