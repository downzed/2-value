import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRestoreOpenItems } from '../../../src/renderer/hooks/useRestoreOpenItems';

vi.mock('../../../src/renderer/hooks/GalleryContext', () => ({
	useGalleryContext: vi.fn(),
}));

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

vi.mock('../../../src/renderer/hooks/useImageLoader', () => ({
	useImageLoader: vi.fn(),
}));

vi.mock('../../../src/renderer/utils/storage', () => ({
	galleryStore: { getThumbnailBlob: vi.fn().mockResolvedValue(undefined) },
}));

import { useGalleryContext } from '../../../src/renderer/hooks/GalleryContext';
import { useImageContext } from '../../../src/renderer/hooks/ImageContext';
import { useImageLoader } from '../../../src/renderer/hooks/useImageLoader';

const KEY = 'image-editor-open-items';
const blob = new Blob(['x'], { type: 'image/png' });

// Stable spies, so assertions don't depend on which mock instance a hook
// happened to read.
const loadFromFile = vi.fn();
const openGalleryImage = vi.fn();

function setup({
	loading = false,
	images = [{ id: 'g1' }],
	restorableItemIds = [] as string[],
	hasDirtyItems = false,
}: {
	loading?: boolean;
	images?: unknown[];
	restorableItemIds?: string[];
	hasDirtyItems?: boolean;
} = {}) {
	loadFromFile.mockResolvedValue({ ok: true });
	openGalleryImage.mockResolvedValue({ blob, fileName: 'restored.png' });
	vi.mocked(useGalleryContext).mockReturnValue({ loading, images, openGalleryImage } as never);
	vi.mocked(useImageContext).mockReturnValue({ restorableItemIds, hasDirtyItems } as never);
	vi.mocked(useImageLoader).mockReturnValue({ loadFromFile } as never);
}

describe('useRestoreOpenItems', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		setup();
	});

	it('persists the restorable item ids once restoration has run', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		setup({ restorableItemIds: ['g1'] });
		renderHook(() => useRestoreOpenItems());

		await waitFor(() => {
			expect(loadFromFile).toHaveBeenCalled();
		});
		await waitFor(() => {
			expect(localStorage.getItem(KEY)).toBe(JSON.stringify(['g1']));
		});
	});

	it('does not clobber the saved list before reading it', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		setup({ restorableItemIds: [] });
		renderHook(() => useRestoreOpenItems());
		// The ids captured on first render must survive long enough to be used.
		await waitFor(() => {
			expect(loadFromFile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ galleryImageId: 'g1' }));
		});
	});

	it('persists nothing while items are still dirty', async () => {
		// Dirty items are filtered out of restorableItemIds by the hook, so a
		// dirty-only session persists an empty list and comes back clean.
		setup({ restorableItemIds: [], hasDirtyItems: true });
		renderHook(() => useRestoreOpenItems());
		await waitFor(() => {
			expect(localStorage.getItem(KEY)).toBe('[]');
		});
	});

	it('reopens persisted gallery items on load', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		setup({});
		renderHook(() => useRestoreOpenItems());

		await waitFor(() => {
			expect(loadFromFile).toHaveBeenCalledTimes(1);
		});
		const [file, meta] = loadFromFile.mock.calls[0];
		expect(file.name).toBe('restored.png');
		expect(meta).toMatchObject({ galleryImageId: 'g1' });
	});

	it('reopens every persisted item', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1', 'g2']));
		setup({});
		renderHook(() => useRestoreOpenItems());

		await waitFor(() => {
			expect(loadFromFile).toHaveBeenCalledTimes(2);
		});
	});

	it('waits for the gallery to finish loading', () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		setup({ loading: true });
		renderHook(() => useRestoreOpenItems());
		expect(loadFromFile).not.toHaveBeenCalled();
	});

	it('skips an entry that can no longer be read', async () => {
		localStorage.setItem(KEY, JSON.stringify(['missing']));
		setup({});
		// setup() installs the default resolver, so override it afterwards.
		openGalleryImage.mockRejectedValue(new Error('Image blob not found'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderHook(() => useRestoreOpenItems());

		await waitFor(() => {
			expect(warn).toHaveBeenCalled();
		});
		expect(loadFromFile).not.toHaveBeenCalled();
	});

	it('ignores malformed persisted data', () => {
		localStorage.setItem(KEY, 'not-json');
		setup({});
		renderHook(() => useRestoreOpenItems());
		expect(loadFromFile).not.toHaveBeenCalled();
	});

	it('filters non-string entries out of the persisted list', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1', 42, null]));
		setup({});
		renderHook(() => useRestoreOpenItems());
		await waitFor(() => {
			expect(loadFromFile).toHaveBeenCalledTimes(1);
		});
	});

	it('restores only once per mount', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		setup({});
		const { rerender } = renderHook(() => useRestoreOpenItems());
		await waitFor(() => {
			expect(loadFromFile).toHaveBeenCalledTimes(1);
		});
		rerender();
		rerender();
		expect(loadFromFile).toHaveBeenCalledTimes(1);
	});
});
