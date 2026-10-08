import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRestorer } from '../../../src/renderer/core/SessionRestorer';
import { EditorStore } from '../../../src/renderer/core/EditorStore';
import { GalleryStore } from '../../../src/renderer/core/GalleryStore';
import type { GalleryRepositoryPort } from '../../../src/renderer/core/GalleryStore';

const KEY = 'image-editor-open-items';
const blob = new Blob(['x'], { type: 'image/png' });
const storedImage = {
	id: 'g1',
	folderId: 'f',
	fileName: 'a.png',
	width: 4,
	height: 4,
	fileSize: 1,
	addedAt: 0,
	source: 'local' as const,
};

vi.mock('../../../src/renderer/utils/storage', () => ({
	galleryRepository: { getThumbnailBlob: vi.fn().mockResolvedValue(undefined) },
}));

function makeRepository(images = [storedImage]): GalleryRepositoryPort {
	return {
		getData: vi.fn().mockResolvedValue({ version: 1, folders: [], images }),
		ensureUnsortedFolder: vi.fn(),
		createFolder: vi.fn(),
		renameFolder: vi.fn(),
		deleteFolder: vi.fn(),
		updateFolderTags: vi.fn(),
		importImage: vi.fn(),
		updateImageBlob: vi.fn(),
		moveImage: vi.fn(),
		copyImage: vi.fn(),
		deleteImage: vi.fn(),
		getImageBlob: vi.fn().mockResolvedValue(blob),
	};
}

describe('SessionRestorer', () => {
	let editor: EditorStore;
	let repository: GalleryRepositoryPort;
	let gallery: GalleryStore;
	let openFile: ReturnType<typeof vi.fn>;

	/** Builds a restorer over fresh stores; call after seeding localStorage. */
	function makeRestorer(onError?: (message: string, error: unknown) => void) {
		editor = new EditorStore();
		repository = makeRepository();
		gallery = new GalleryStore(repository);
		openFile = vi.fn().mockResolvedValue({ ok: true });
		return new SessionRestorer({ editor, gallery, openFile, storageKey: KEY, onError });
	}

	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	it('reopens every persisted item', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1', 'g2']));
		const restorer = makeRestorer();

		await gallery.loadGallery();
		restorer.start();

		await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(2));
	});

	it('does not clobber the saved list before reading it', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		const restorer = makeRestorer();

		await gallery.loadGallery();
		restorer.start();

		await vi.waitFor(() =>
			expect(openFile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ galleryImageId: 'g1' })),
		);
	});

	it('restores when the gallery was already loaded before start', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		const restorer = makeRestorer();

		// Loaded first, so no notification arrives after the restorer subscribes.
		await gallery.loadGallery();
		restorer.start();

		await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
	});

	it('persists the restorable ids once restoration has run', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		const restorer = makeRestorer();
		await editor.loadImage({ width: 4, height: 4 } as never, 'a.png', { galleryImageId: 'g1' });

		await gallery.loadGallery();
		restorer.start();
		await vi.waitFor(() => expect(openFile).toHaveBeenCalled());

		expect(localStorage.getItem(KEY)).toBe(JSON.stringify(['g1']));
	});

	it('waits for the gallery to report images', () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		const restorer = makeRestorer();
		restorer.start();

		expect(openFile).not.toHaveBeenCalled();
	});

	it('skips an entry that can no longer be read', async () => {
		localStorage.setItem(KEY, JSON.stringify(['missing']));
		const onError = vi.fn();
		const restorer = makeRestorer(onError);
		vi.mocked(repository.getImageBlob).mockResolvedValue(undefined);

		await gallery.loadGallery();
		restorer.start();

		await vi.waitFor(() => expect(onError).toHaveBeenCalled());
		expect(openFile).not.toHaveBeenCalled();
	});

	it('ignores malformed persisted data', async () => {
		localStorage.setItem(KEY, 'not-json');
		const restorer = makeRestorer();

		await gallery.loadGallery();
		restorer.start();

		expect(openFile).not.toHaveBeenCalled();
	});

	it('filters non-string entries out of the persisted list', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1', 42, null]));
		const restorer = makeRestorer();

		await gallery.loadGallery();
		restorer.start();

		await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
	});

	it('restores only once across repeated notifications', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		const restorer = makeRestorer();

		await gallery.loadGallery();
		restorer.start();
		await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));

		// Re-subscribing must not replay the pending list.
		restorer.stop();
		restorer.start();
		expect(openFile).toHaveBeenCalledTimes(1);
	});

	it('stops persisting after stop', async () => {
		const restorer = makeRestorer();
		await gallery.loadGallery();
		restorer.start();
		localStorage.clear();

		restorer.stop();
		editor.newBlankCanvas();

		expect(localStorage.getItem(KEY)).toBe(null);
	});

	it('is idempotent on repeated start', async () => {
		localStorage.setItem(KEY, JSON.stringify(['g1']));
		const restorer = makeRestorer();

		await gallery.loadGallery();
		restorer.start();
		restorer.start();

		await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
	});
});
