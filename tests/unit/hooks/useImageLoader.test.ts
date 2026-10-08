import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useImageLoader } from '../../../src/renderer/hooks/useImageLoader';
import { decodeImageFile } from '../../../src/renderer/core/decode';

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

vi.mock('../../../src/renderer/core/decode', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../src/renderer/core/decode')>();
	return { ...actual, decodeImageFile: vi.fn() };
});

import { useImageContext } from '../../../src/renderer/hooks/ImageContext';

const loadImage = vi.fn();

/**
 * Decoding itself is tested in tests/unit/core/decode.test.ts. This covers only
 * what the binding adds: handing the decoded image to the editor store.
 */
describe('useImageLoader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadImage.mockResolvedValue(undefined);
		vi.mocked(useImageContext).mockReturnValue({ loadImage } as never);
	});

	it('opens a decoded file as an item named after the file', async () => {
		const image = { width: 10, height: 10 };
		vi.mocked(decodeImageFile).mockResolvedValue({ ok: true, image: image as never });

		const { result } = renderHook(() => useImageLoader());
		const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

		const outcome = await result.current.loadFromFile(file);

		expect(outcome).toEqual({ ok: true });
		expect(loadImage).toHaveBeenCalledWith(image, 'photo.jpg', {});
	});

	it('forwards gallery metadata to the store', async () => {
		const image = { width: 10, height: 10 };
		vi.mocked(decodeImageFile).mockResolvedValue({ ok: true, image: image as never });

		const { result } = renderHook(() => useImageLoader());
		const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

		await result.current.loadFromFile(file, { galleryImageId: 'g1' });

		expect(loadImage).toHaveBeenCalledWith(image, 'photo.jpg', { galleryImageId: 'g1' });
	});

	it('passes a decode failure through without opening an item', async () => {
		const error = { code: 'FILE_TOO_LARGE', fileSize: 1, maxBytes: 2 } as const;
		vi.mocked(decodeImageFile).mockResolvedValue({ ok: false, error });

		const { result } = renderHook(() => useImageLoader());
		const file = new File(['x'], 'huge.png', { type: 'image/png' });

		const outcome = await result.current.loadFromFile(file);

		expect(outcome).toEqual({ ok: false, error });
		expect(loadImage).not.toHaveBeenCalled();
	});
});
