import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useGallery } from '../../../src/renderer/hooks/useGallery';

vi.mock('../../../src/renderer/utils/storage', () => ({
	galleryRepository: {
		getData: vi.fn().mockResolvedValue({ version: 1, folders: [], images: [] }),
		ensureUnsortedFolder: vi
			.fn()
			.mockResolvedValue({ id: 'unsorted', name: 'Unsorted', tags: [], createdAt: 0, sortOrder: 0 }),
		createFolder: vi.fn(),
		renameFolder: vi.fn(),
		deleteFolder: vi.fn(),
		updateFolderTags: vi.fn(),
		importImage: vi.fn(),
		updateImageBlob: vi.fn(),
		moveImage: vi.fn(),
		copyImage: vi.fn(),
		deleteImage: vi.fn(),
		getImageBlob: vi.fn(),
	},
}));

/**
 * The domain logic now lives in GalleryStore and is tested in
 * tests/unit/core/GalleryStore.test.ts. This covers only what the React binding
 * still does: project the snapshot and keep subscribers up to date.
 */
describe('useGallery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('projects the store snapshot', () => {
		const { result } = renderHook(() => useGallery());

		expect(result.current.folders).toEqual([]);
		expect(result.current.images).toEqual([]);
		expect(result.current.selectedFolderId).toBe(null);
		expect(result.current.gallerySearchQuery).toBe('');
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBe(null);
	});

	it('re-renders when the underlying store changes', async () => {
		const { result } = renderHook(() => useGallery());

		act(() => {
			result.current.setSelectedFolder('f1');
		});

		expect(result.current.selectedFolderId).toBe('f1');
	});

	it('keeps action identities stable across renders', () => {
		const { result, rerender } = renderHook(() => useGallery());
		const first = {
			loadGallery: result.current.loadGallery,
			createFolder: result.current.createFolder,
			setSelectedFolder: result.current.setSelectedFolder,
		};

		rerender();

		expect(result.current.loadGallery).toBe(first.loadGallery);
		expect(result.current.createFolder).toBe(first.createFolder);
		expect(result.current.setSelectedFolder).toBe(first.setSelectedFolder);
	});
});
