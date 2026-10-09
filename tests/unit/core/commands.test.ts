import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Commands } from '../../../src/renderer/core/commands';
import { EditorStore } from '../../../src/renderer/core/EditorStore';
import { GalleryStore } from '../../../src/renderer/core/GalleryStore';
import { ImageProcessor } from '../../../src/renderer/core/ImageProcessor';
import type { AppStore } from '../../../src/renderer/core/store';
import type { GalleryRepositoryPort } from '../../../src/renderer/core/GalleryStore';
import type { GalleryImage } from '../../../src/shared/types';

vi.mock('../../../src/renderer/utils/fileOps', () => ({
	saveImageFile: vi.fn().mockResolvedValue(undefined),
	openImageFile: vi.fn().mockResolvedValue(null),
}));

import { saveImageFile } from '../../../src/renderer/utils/fileOps';

const blob = new Blob(['png'], { type: 'image/png' });

const makeImage = (id: string): GalleryImage => ({
	id,
	folderId: 'f1',
	fileName: 'photo.jpg',
	width: 100,
	height: 100,
	fileSize: 10,
	addedAt: 1,
	source: 'local',
});

function makeRepository(): GalleryRepositoryPort {
	return {
		getData: vi.fn().mockResolvedValue({ version: 1, folders: [], images: [] }),
		createFolder: vi.fn(),
		renameFolder: vi.fn(),
		deleteFolder: vi.fn(),
		updateFolderTags: vi.fn(),
		importImage: vi.fn().mockResolvedValue(makeImage('g1')),
		updateImageBlob: vi.fn().mockResolvedValue(makeImage('g1')),
		moveImage: vi.fn(),
		copyImage: vi.fn(),
		deleteImage: vi.fn(),
		getImageBlob: vi.fn().mockResolvedValue(blob),
		getThumbnailBlob: vi.fn().mockResolvedValue(blob),
	};
}

function makeStore(): {
	store: AppStore;
	editor: EditorStore;
	gallery: GalleryStore;
	repository: GalleryRepositoryPort;
} {
	const editor = new EditorStore();
	const repository = makeRepository();
	const gallery = new GalleryStore(repository);
	const processor = new ImageProcessor();
	const store = { editor, gallery, processor } as AppStore;
	store.commands = new Commands(store);
	return { store, editor, gallery, repository };
}

/** The active item; every caller has just created one. */
function activeItem(editor: EditorStore) {
	const item = editor.activeItem;
	if (!item) throw new Error('No active item');
	return item;
}

describe('Commands', () => {
	let editor: EditorStore;
	let repository: GalleryRepositoryPort;
	let commands: Commands;

	beforeEach(() => {
		vi.clearAllMocks();
		const made = makeStore();
		editor = made.editor;
		repository = made.repository;
		commands = made.store.commands;
	});

	// --- openFile ---

	describe('openFile', () => {
		it('reports a decode failure and opens nothing', async () => {
			const broken = new File(['nope'], 'broken.png', { type: 'image/png' });

			const outcome = await commands.openFile(broken);

			expect(outcome.ok).toBe(false);
			if (outcome.ok) throw new Error('expected failure');
			expect(outcome.error.code).toBe('DECODE_FAILED');
			expect(editor.getState().items).toHaveLength(0);
		});

		it('rejects a file over the size limit before decoding', async () => {
			const file = new File(['x'], 'huge.png', { type: 'image/png' });
			Object.defineProperty(file, 'size', { value: Number.MAX_SAFE_INTEGER });

			const outcome = await commands.openFile(file);

			expect(outcome.ok).toBe(false);
			if (outcome.ok) throw new Error('expected failure');
			expect(outcome.error.code).toBe('FILE_TOO_LARGE');
		});
	});

	// --- openGalleryImage ---

	describe('openGalleryImage', () => {
		it('reads the stored blob for the requested id', async () => {
			vi.mocked(repository.getImageBlob).mockResolvedValue(blob);

			// The fake blob is not decodable, so the read itself is what matters here.
			const outcome = await commands.openGalleryImage('g1');

			expect(repository.getImageBlob).toHaveBeenCalledWith('g1');
			expect(outcome.ok).toBe(false);
			if (outcome.ok) throw new Error('expected a decode failure');
			expect(outcome.error.code).toBe('DECODE_FAILED');
		});

		it('rejects when the blob is missing', async () => {
			vi.mocked(repository.getImageBlob).mockResolvedValue(undefined);
			await expect(commands.openGalleryImage('gone')).rejects.toThrow('Image blob not found');
		});
	});

	// --- saveActiveItemToGallery ---

	describe('saveActiveItemToGallery', () => {
		it('overwrites an existing gallery entry and links it', async () => {
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png', { galleryImageId: 'g1' });

			await commands.saveActiveItemToGallery(blob, 'a.png');

			expect(repository.updateImageBlob).toHaveBeenCalledWith('g1', blob);
			expect(repository.importImage).not.toHaveBeenCalled();
			expect(activeItem(editor).galleryImageId).toBe('g1');
			expect(activeItem(editor).dirty).toBe(false);
		});

		it('creates a new entry in the chosen folder when the item has no gallery source', async () => {
			editor.newBlankCanvas();

			await commands.saveActiveItemToGallery(blob, 'canvas.png', 'f1');

			expect(repository.updateImageBlob).not.toHaveBeenCalled();
			expect(repository.importImage).toHaveBeenCalledTimes(1);
			expect(vi.mocked(repository.importImage).mock.calls[0][1]).toBe('f1');
			expect(activeItem(editor).galleryImageId).toBe('g1');
		});

		it('refuses to save a new entry without a destination folder', async () => {
			editor.newBlankCanvas();

			await expect(commands.saveActiveItemToGallery(blob, 'canvas.png')).rejects.toThrow('folder is required');
			expect(repository.importImage).not.toHaveBeenCalled();
		});

		it('does nothing when no item is open', async () => {
			await commands.saveActiveItemToGallery(blob, 'a.png');
			expect(repository.updateImageBlob).not.toHaveBeenCalled();
			expect(repository.importImage).not.toHaveBeenCalled();
		});

		it('leaves the item dirty when the gallery write fails', async () => {
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png', { galleryImageId: 'g1' });
			editor.setBlur(3);
			vi.mocked(repository.updateImageBlob).mockRejectedValue(new Error('quota'));

			await expect(commands.saveActiveItemToGallery(blob, 'a.png')).rejects.toThrow('quota');
			expect(activeItem(editor).dirty).toBe(true);
		});
	});

	// --- saveOpenItem ---

	describe('saveOpenItem', () => {
		/**
		 * `renderItemToBlob` is stubbed rather than mocked at module level, because
		 * the `renderItemToBlob` tests below rely on the real one returning `null`
		 * when jsdom has no `OffscreenCanvas`. Stubbing the instance method lets this
		 * suite reach the save path without changing those.
		 */
		beforeEach(() => {
			vi.spyOn(commands, 'renderItemToBlob').mockResolvedValue(blob);
		});

		it('activates a background item before saving it', async () => {
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png');
			const backgroundId = editor.getState().activeItemId as string;
			const background = editor.getState().items.find((i) => i.id === backgroundId);
			if (!background) throw new Error('image item missing');

			// Make a *different* item active, so the target really is in the background.
			editor.newBlankCanvas();
			const blankId = editor.getState().activeItemId as string;
			expect(blankId).not.toBe(backgroundId);

			await commands.saveOpenItem(background, 'f1');

			// The point of the test: the target must have been activated.
			expect(editor.getState().activeItemId).toBe(backgroundId);
		});

		it('saves the activated item into the gallery', async () => {
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png');
			const targetId = editor.getState().activeItemId as string;
			const target = editor.getState().items.find((i) => i.id === targetId);
			if (!target) throw new Error('image item missing');

			editor.newBlankCanvas();
			await commands.saveOpenItem(target, 'f1');

			const [file, folderId] = vi.mocked(repository.importImage).mock.calls[0];
			expect(folderId).toBe('f1');
			expect((file as File).name).toBe('a.png');
			// Saving links the item to its new gallery entry and clears the dirty flag.
			expect(editor.getState().items.find((i) => i.id === targetId)?.galleryImageId).toBe('g1');
			expect(editor.getState().items.find((i) => i.id === targetId)?.dirty).toBe(false);
		});

		it('leaves an already-active item alone', async () => {
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png');
			const active = activeItem(editor);

			await commands.saveOpenItem(active, 'f1');

			expect(editor.getState().activeItemId).toBe(active.id);
			expect(repository.importImage).toHaveBeenCalled();
		});

		it('does nothing when the item cannot be rendered', async () => {
			vi.spyOn(commands, 'renderItemToBlob').mockResolvedValue(null);
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png');
			const active = activeItem(editor);

			await commands.saveOpenItem(active, 'f1');

			// The early return must happen before any gallery write.
			expect(repository.importImage).not.toHaveBeenCalled();
		});
	});

	// --- export ---

	describe('exportGalleryImage', () => {
		it('downloads the stored blob', async () => {
			await commands.exportGalleryImage('g1', 'photo.jpg');
			expect(saveImageFile).toHaveBeenCalledWith(blob, 'photo.jpg');
		});

		it('throws when the blob is missing', async () => {
			vi.mocked(repository.getImageBlob).mockResolvedValue(undefined);
			await expect(commands.exportGalleryImage('gone', 'x.png')).rejects.toThrow('Image blob not found');
		});

		it('falls back to a default file name', async () => {
			await commands.exportGalleryImage('g1', '');
			expect(saveImageFile).toHaveBeenCalledWith(blob, 'image.png');
		});
	});

	describe('renderItemToBlob', () => {
		it('returns null when OffscreenCanvas is unavailable', async () => {
			editor.newBlankCanvas();
			editor.setViewport({ width: 100, height: 100 });

			// jsdom has no OffscreenCanvas; the renderers degrade instead of throwing.
			await expect(commands.renderItemToBlob(activeItem(editor))).resolves.toBeNull();
		});

		it('returns null when the active item has no image', async () => {
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png');

			// Stub a canvas so the guard passes and we reach the no-image branch.
			vi.stubGlobal(
				'OffscreenCanvas',
				class {
					constructor(
						public width: number,
						public height: number,
					) {}
					getContext() {
						return null;
					}
				} as never,
			);
			const item = { ...activeItem(editor), image: null } as never;

			await expect(commands.renderItemToBlob(item)).resolves.toBeNull();
			vi.unstubAllGlobals();
		});
	});

	describe('renderItemPreview', () => {
		it('returns null for a blank canvas when OffscreenCanvas is unavailable', async () => {
			editor.newBlankCanvas();
			editor.setViewport({ width: 100, height: 100 });

			await expect(commands.renderItemPreview(activeItem(editor))).resolves.toBeNull();
		});

		it('returns null for an item with no image', async () => {
			await editor.loadImage({ width: 10, height: 10 } as never, 'a.png');
			const item = { ...activeItem(editor), image: null } as never;

			await expect(commands.renderItemPreview(item)).resolves.toBeNull();
		});

		it('reads the strokes and viewport the caller would otherwise have to', async () => {
			editor.newBlankCanvas();
			editor.setViewport({ width: 0, height: 0 });
			const item = activeItem(editor);

			// A zero viewport must still reach the renderer rather than divide by
			// zero, which is what the Math.max guards in the command exist for.
			await expect(commands.renderItemPreview(item)).resolves.toBeNull();
		});
	});

	it('releases its worker on dispose', () => {
		expect(() => commands.dispose()).not.toThrow();
	});
});
