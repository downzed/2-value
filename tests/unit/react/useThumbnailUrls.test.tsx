import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThumbnailUrls } from '../../../src/renderer/react/useThumbnailUrls';
import type { GalleryImage } from '../../../src/shared/types';

const image = (id: string): GalleryImage => ({
	id,
	folderId: 'f1',
	fileName: `${id}.png`,
	width: 10,
	height: 10,
	fileSize: 0,
	addedAt: 0,
	source: 'local',
});

/**
 * `URL.createObjectURL` is stubbed with a counter so each blob gets a distinct,
 * identifiable URL. Revoking a real one in jsdom is a no-op, so the recorded
 * calls are the only way to observe the bookkeeping.
 */
describe('useThumbnailUrls', () => {
	let created: string[];
	let revoked: string[];

	beforeEach(() => {
		created = [];
		revoked = [];
		let n = 0;
		vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
			const url = `blob:${n++}`;
			created.push(url);
			return url;
		});
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
			revoked.push(url);
		});
	});

	const blob = () => new Blob(['x']);

	it('creates a URL per image', async () => {
		const { result } = renderHook(() => useThumbnailUrls([image('a'), image('b')], vi.fn().mockResolvedValue(blob())));

		await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
		expect(result.current.a).toBeTruthy();
		expect(result.current.b).toBeTruthy();
	});

	it('leaves images with no thumbnail unkeyed', async () => {
		const get = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useThumbnailUrls([image('a')], get));

		await waitFor(() => expect(get).toHaveBeenCalled());
		expect(result.current).toEqual({});
	});

	it('survives a thumbnail read that rejects', async () => {
		const get = vi.fn().mockRejectedValue(new Error('gone'));
		const { result } = renderHook(() => useThumbnailUrls([image('a')], get));

		await waitFor(() => expect(get).toHaveBeenCalled());
		expect(result.current).toEqual({});
	});

	/**
	 * The regression. `GalleryStore.loadGallery` replaces the `images` array with a
	 * fresh identity on every load, and `#runMutation` calls it after every write.
	 * A cleanup that revokes *every* URL it made therefore revokes URLs that are
	 * still sitting in state, killing every thumbnail after the first mutation.
	 */
	it('does not revoke URLs that are still committed to state', async () => {
		const get = vi.fn().mockResolvedValue(blob());
		const { result, rerender } = renderHook(({ images }) => useThumbnailUrls(images, get), {
			initialProps: { images: [image('a')] },
		});

		await waitFor(() => expect(result.current.a).toBeTruthy());
		const firstUrl = result.current.a;

		// Same image ids, new array identity — what a gallery reload looks like.
		rerender({ images: [image('a')] });
		await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

		expect(result.current.a).toBe(firstUrl);
		expect(revoked).not.toContain(firstUrl);
	});

	it('does not refetch images it already has a URL for', async () => {
		const get = vi.fn().mockResolvedValue(blob());
		const { rerender } = renderHook(({ images }) => useThumbnailUrls(images, get), {
			initialProps: { images: [image('a')] },
		});
		await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

		rerender({ images: [image('a')] });
		await new Promise((r) => setTimeout(r, 10));

		expect(get).toHaveBeenCalledTimes(1);
	});

	it('only fetches images it has not seen', async () => {
		const get = vi.fn().mockResolvedValue(blob());
		const { rerender } = renderHook(({ images }) => useThumbnailUrls(images, get), {
			initialProps: { images: [image('a')] },
		});
		await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

		rerender({ images: [image('a'), image('b')] });
		await waitFor(() => expect(get).toHaveBeenCalledTimes(2));

		expect(get).toHaveBeenLastCalledWith('b');
	});

	it('revokes the URL for an image that disappears', async () => {
		const get = vi.fn().mockResolvedValue(blob());
		const { result, rerender } = renderHook(({ images }) => useThumbnailUrls(images, get), {
			initialProps: { images: [image('a')] },
		});
		await waitFor(() => expect(result.current.a).toBeTruthy());
		const firstUrl = result.current.a;

		rerender({ images: [] });

		await waitFor(() => expect(result.current.a).toBeUndefined());
		expect(revoked).toContain(firstUrl);
	});

	it('keeps the URL of an image that is still present after a reload', async () => {
		const get = vi.fn().mockResolvedValue(blob());
		const { result, rerender } = renderHook(({ images }) => useThumbnailUrls(images, get), {
			initialProps: { images: [image('a')] },
		});
		await waitFor(() => expect(result.current.a).toBeTruthy());
		const firstUrl = result.current.a;

		rerender({ images: [image('a'), image('b')] });
		await waitFor(() => expect(result.current.b).toBeTruthy());

		// Adding an image must not disturb the one already displayed.
		expect(result.current.a).toBe(firstUrl);
		expect(revoked).not.toContain(firstUrl);
	});

	it('revokes everything still outstanding on unmount', async () => {
		const get = vi.fn().mockResolvedValue(blob());
		const { result, unmount } = renderHook(() => useThumbnailUrls([image('a'), image('b')], get));
		await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
		const urls = Object.values(result.current);

		unmount();

		for (const url of urls) {
			expect(revoked).toContain(url);
		}
	});

	it('does not leak URLs for a fetch cancelled before it commits', async () => {
		let resolveBlob: (b: Blob) => void = () => {};
		const pending = new Promise<Blob>((r) => {
			resolveBlob = r;
		});
		const get = vi.fn().mockReturnValue(pending);
		const { unmount } = renderHook(() => useThumbnailUrls([image('a')], get));

		// Unmount while the read is still in flight, then let it finish.
		unmount();
		resolveBlob(blob());
		await new Promise((r) => setTimeout(r, 10));

		// Either no URL was made, or the one that was got revoked. Nothing may
		// survive, because it never reached state to be revoked later.
		expect(revoked).toHaveLength(created.length);
	});
});
