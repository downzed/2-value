import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSaveToGallery } from '../../../src/renderer/hooks/useSaveToGallery';

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

vi.mock('../../../src/renderer/hooks/GalleryContext', () => ({
	useGalleryContext: vi.fn(),
}));

import { useImageContext } from '../../../src/renderer/hooks/ImageContext';
import { useGalleryContext } from '../../../src/renderer/hooks/GalleryContext';

const blob = new Blob(['png'], { type: 'image/png' });

function makeItem(overrides: Record<string, unknown> = {}) {
	return {
		id: 'item-1',
		kind: 'blank',
		label: 'Canvas 1',
		fileName: '',
		image: null,
		galleryImageId: null,
		...overrides,
	};
}

const saveImageToGallery = vi.fn();
const linkGalleryImage = vi.fn();
const markActiveSaved = vi.fn();

function setup({ activeItemId = 'item-1', items = [makeItem()] } = {}) {
	vi.mocked(useImageContext).mockReturnValue({ activeItemId, items, linkGalleryImage, markActiveSaved } as never);
	vi.mocked(useGalleryContext).mockReturnValue({ saveImageToGallery } as never);
}

describe('useSaveToGallery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		saveImageToGallery.mockResolvedValue('g-new');
		setup();
	});

	it('overwrites an existing gallery entry and links it', async () => {
		setup({ items: [makeItem({ galleryImageId: 'g1' })] });
		const { result } = renderHook(() => useSaveToGallery());

		await act(async () => {
			await result.current(blob, 'a.png');
		});

		expect(saveImageToGallery).toHaveBeenCalledWith(blob, 'a.png', 'g1');
		expect(linkGalleryImage).toHaveBeenCalledWith('item-1', 'g-new');
		expect(markActiveSaved).toHaveBeenCalled();
	});

	it('creates a new entry when the item has no gallery source', async () => {
		const { result } = renderHook(() => useSaveToGallery());

		await act(async () => {
			await result.current(blob, 'a.png');
		});

		expect(saveImageToGallery).toHaveBeenCalledWith(blob, 'a.png', null);
	});

	it('does nothing when no item is active', async () => {
		setup({ activeItemId: null });
		const { result } = renderHook(() => useSaveToGallery());

		await act(async () => {
			await result.current(blob, 'a.png');
		});

		expect(saveImageToGallery).not.toHaveBeenCalled();
		expect(markActiveSaved).not.toHaveBeenCalled();
	});

	it('does not mark saved when the gallery write fails', async () => {
		saveImageToGallery.mockRejectedValue(new Error('quota exceeded'));
		const { result } = renderHook(() => useSaveToGallery());

		await act(async () => {
			await expect(result.current(blob, 'a.png')).rejects.toThrow('quota exceeded');
		});

		expect(markActiveSaved).not.toHaveBeenCalled();
	});

	it('does nothing if the active item vanished', async () => {
		setup({ items: [] });
		const { result } = renderHook(() => useSaveToGallery());

		await act(async () => {
			await result.current(blob, 'a.png');
		});

		expect(saveImageToGallery).not.toHaveBeenCalled();
	});
});
