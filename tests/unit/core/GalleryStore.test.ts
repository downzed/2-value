import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GalleryStore } from '../../../src/renderer/core/GalleryStore';
import type { GalleryRepositoryPort } from '../../../src/renderer/core/GalleryStore';
import type { GalleryImage } from '../../../src/shared/types';

const makeImage = (id: string, fileName: string, folderId = 'f1'): GalleryImage => ({
	id,
	folderId,
	fileName,
	width: 100,
	height: 100,
	fileSize: 1024,
	addedAt: 1,
	source: 'local',
});

const makeFolder = (id: string, name: string, sortOrder = 0) => ({
	id,
	name,
	tags: [],
	createdAt: 0,
	sortOrder,
});

function makeRepository(overrides: Partial<GalleryRepositoryPort> = {}) {
	const repo: GalleryRepositoryPort = {
		getData: vi.fn().mockResolvedValue({ version: 1, folders: [], images: [] }),
		ensureUnsortedFolder: vi.fn().mockResolvedValue(makeFolder('unsorted', 'Unsorted')),
		createFolder: vi.fn().mockResolvedValue(makeFolder('f1', 'Refs')),
		renameFolder: vi.fn().mockResolvedValue(undefined),
		deleteFolder: vi.fn().mockResolvedValue(undefined),
		updateFolderTags: vi.fn().mockResolvedValue(undefined),
		importImage: vi.fn().mockResolvedValue(makeImage('g1', 'study.png', 'unsorted')),
		updateImageBlob: vi.fn().mockResolvedValue(makeImage('g1', 'study.png', 'unsorted')),
		moveImage: vi.fn().mockResolvedValue(undefined),
		copyImage: vi.fn().mockResolvedValue(makeImage('g2', 'study.png', 'f1')),
		deleteImage: vi.fn().mockResolvedValue(undefined),
		getImageBlob: vi.fn().mockResolvedValue(new Blob(['x'])),
		...overrides,
	};
	return repo;
}

describe('GalleryStore', () => {
	let repo: GalleryRepositoryPort;
	let store: GalleryStore;

	beforeEach(() => {
		repo = makeRepository();
		store = new GalleryStore(repo);
	});

	// --- Initial state ---

	it('starts with empty folders and images', () => {
		const s = store.getState();
		expect(s.folders).toEqual([]);
		expect(s.images).toEqual([]);
		expect(store.filteredImages).toEqual([]);
		expect(s.gallerySearchQuery).toBe('');
		expect(s.loading).toBe(false);
		expect(s.error).toBe(null);
	});

	// --- Loading ---

	describe('loadGallery', () => {
		it('sets loading=true while the request is in-flight and false after', async () => {
			let release!: () => void;
			vi.mocked(repo.getData).mockReturnValue(
				new Promise((resolve) => {
					release = () => resolve({ version: 1, folders: [], images: [] });
				}) as never,
			);

			const pending = store.loadGallery();
			expect(store.getState().loading).toBe(true);

			release();
			await pending;
			expect(store.getState().loading).toBe(false);
		});

		it('does not create any folders as a side effect of loading', async () => {
			await store.loadGallery();
			// No implicit "Unsorted" folder: a fresh install starts with none.
			expect(repo.createFolder).not.toHaveBeenCalled();
		});

		it('stores folders and images from the repository', async () => {
			vi.mocked(repo.getData).mockResolvedValue({
				version: 1,
				folders: [makeFolder('f1', 'Refs')],
				images: [makeImage('g1', 'a.jpg')],
			});

			await store.loadGallery();

			expect(store.getState().folders).toHaveLength(1);
			expect(store.getState().images).toHaveLength(1);
			expect(store.getState().error).toBe(null);
		});

		it('sets a generic error string on failure', async () => {
			vi.mocked(repo.getData).mockRejectedValue(new Error('nope'));

			await store.loadGallery();

			expect(store.getState().error).toBe('Failed to load gallery.');
			expect(store.getState().loading).toBe(false);
		});

		it('ignores a stale response that resolves after a newer one', async () => {
			vi.mocked(repo.getData)
				.mockResolvedValueOnce({ version: 1, folders: [makeFolder('stale', 'Stale')], images: [] })
				.mockResolvedValueOnce({ version: 1, folders: [makeFolder('fresh', 'Fresh')], images: [] });

			// Fire both without awaiting, so the second generation wins.
			const first = store.loadGallery();
			const second = store.loadGallery();
			await Promise.all([first, second]);

			expect(store.getState().folders.map((f) => f.name)).toEqual(['Fresh']);
		});
	});

	// --- Selection and search ---

	describe('selection and search', () => {
		beforeEach(async () => {
			vi.mocked(repo.getData).mockResolvedValue({
				version: 1,
				folders: [],
				images: [makeImage('g1', 'Alpha.jpg'), makeImage('g2', 'beta.PNG')],
			});
			await store.loadGallery();
		});

		it('returns all images when the query is empty', () => {
			expect(store.filteredImages).toHaveLength(2);
		});

		it('returns all images when the query is whitespace only', () => {
			store.setGallerySearchQuery('   ');
			expect(store.filteredImages).toHaveLength(2);
		});

		it('filters case-insensitively by substring', () => {
			store.setGallerySearchQuery('alpha');
			expect(store.filteredImages.map((i) => i.fileName)).toEqual(['Alpha.jpg']);
		});

		it('is case-insensitive for an uppercase query', () => {
			store.setGallerySearchQuery('BETA');
			expect(store.filteredImages.map((i) => i.fileName)).toEqual(['beta.PNG']);
		});

		it('returns an empty array when nothing matches', () => {
			store.setGallerySearchQuery('zzz');
			expect(store.filteredImages).toEqual([]);
		});

		it('trims leading and trailing whitespace from the query', () => {
			store.setGallerySearchQuery('  alpha  ');
			expect(store.filteredImages).toHaveLength(1);
		});

		it('clears the search query', () => {
			store.setGallerySearchQuery('alpha');
			store.setGallerySearchQuery('');
			expect(store.filteredImages).toHaveLength(2);
		});

		it('selects and clears the selected folder', () => {
			store.setSelectedFolder('f1');
			expect(store.getState().selectedFolderId).toBe('f1');

			store.setSelectedFolder(null);
			expect(store.getState().selectedFolderId).toBe(null);
		});
	});

	// --- Mutations ---

	describe('mutations', () => {
		it('creates a folder and reloads', async () => {
			await store.createFolder('Refs', ['landscape']);
			expect(repo.createFolder).toHaveBeenCalledWith('Refs', ['landscape']);
			expect(repo.getData).toHaveBeenCalled();
		});

		it('renames a folder', async () => {
			await store.renameFolder('f1', 'New name');
			expect(repo.renameFolder).toHaveBeenCalledWith('f1', 'New name');
		});

		it('clears the selection when the selected folder is deleted', async () => {
			store.setSelectedFolder('f1');
			await store.deleteFolder('f1', false);
			expect(store.getState().selectedFolderId).toBe(null);
		});

		it('keeps the selection when a different folder is deleted', async () => {
			store.setSelectedFolder('f2');
			await store.deleteFolder('f1', true);
			expect(store.getState().selectedFolderId).toBe('f2');
		});

		it('updates folder tags', async () => {
			await store.updateFolderTags('f1', ['a', 'b']);
			expect(repo.updateFolderTags).toHaveBeenCalledWith('f1', ['a', 'b']);
		});

		it('moves an image', async () => {
			await store.moveImage('g1', 'f2');
			expect(repo.moveImage).toHaveBeenCalledWith('g1', 'f2');
		});

		it('copies an image', async () => {
			await store.copyImage('g1', 'f2');
			expect(repo.copyImage).toHaveBeenCalledWith('g1', 'f2');
		});

		it('deletes an image', async () => {
			await store.deleteImage('g1');
			expect(repo.deleteImage).toHaveBeenCalledWith('g1');
		});

		it('imports an image and returns it', async () => {
			const file = new Blob(['x'], { type: 'image/png' }) as unknown as File;
			const result = await store.importImage(file, 'f1');
			expect(result.id).toBe('g1');
		});

		it('re-throws and records the error when a mutation fails', async () => {
			vi.mocked(repo.createFolder).mockRejectedValue(new Error('disk full'));

			await expect(store.createFolder('Refs')).rejects.toThrow('disk full');
			expect(store.getState().error).toBe('disk full');
		});

		it('falls back to a generic message for a non-Error rejection', async () => {
			vi.mocked(repo.createFolder).mockRejectedValue('nope');

			await expect(store.createFolder('Refs')).rejects.toBe('nope');
			expect(store.getState().error).toBe('Failed to create folder.');
		});

		it('clears a previous error at the start of the next mutation', async () => {
			vi.mocked(repo.createFolder).mockRejectedValueOnce(new Error('disk full'));
			await expect(store.createFolder('Refs')).rejects.toThrow();
			expect(store.getState().error).toBe('disk full');

			await store.createFolder('Refs');
			expect(store.getState().error).toBe(null);
		});

		it('clears the error on demand', async () => {
			vi.mocked(repo.createFolder).mockRejectedValue(new Error('disk full'));
			await expect(store.createFolder('Refs')).rejects.toThrow();

			store.clearError();
			expect(store.getState().error).toBe(null);
		});
	});

	// --- Reading image bytes ---

	describe('openGalleryImage', () => {
		it('returns the blob plus metadata', async () => {
			vi.mocked(repo.getData).mockResolvedValue({
				version: 1,
				folders: [],
				images: [makeImage('g1', 'photo.jpg')],
			});
			await store.loadGallery();

			const result = await store.openGalleryImage('g1');
			expect(result.fileName).toBe('photo.jpg');
			expect(result.fileSize).toBe(1024);
			expect(result.blob).toBeInstanceOf(Blob);
		});

		it('throws when the blob is missing', async () => {
			vi.mocked(repo.getImageBlob).mockResolvedValue(undefined);
			await expect(store.openGalleryImage('gone')).rejects.toThrow('Image blob not found');
		});

		it('falls back to Unknown when metadata is missing', async () => {
			const result = await store.openGalleryImage('unlisted');
			expect(result.fileName).toBe('Unknown');
		});

		it('exposes the raw blob getter for export', async () => {
			await store.getImageBlob('g1');
			expect(repo.getImageBlob).toHaveBeenCalledWith('g1');
		});
	});

	// --- saveImageToGallery ---

	describe('saveImageToGallery', () => {
		it('overwrites the existing entry rather than creating a duplicate', async () => {
			const id = await store.saveImageToGallery(new Blob(['x']), 'study.png', 'g1');

			expect(repo.updateImageBlob).toHaveBeenCalledTimes(1);
			expect(repo.importImage).not.toHaveBeenCalled();
			expect(id).toBe('g1');
		});

		it('creates an entry in the chosen folder when there is no existing one', async () => {
			const id = await store.saveImageToGallery(new Blob(['x'], { type: 'image/png' }), 'study.png', null, 'f1');

			expect(repo.updateImageBlob).not.toHaveBeenCalled();
			expect(repo.importImage).toHaveBeenCalledTimes(1);
			expect(vi.mocked(repo.importImage).mock.calls[0][1]).toBe('f1');
			expect(id).toBe('g1');
		});

		it('refuses to create an entry without a destination folder', async () => {
			await expect(store.saveImageToGallery(new Blob(['x']), 'study.png', null, null)).rejects.toThrow(
				'A folder is required',
			);
			expect(repo.importImage).not.toHaveBeenCalled();
		});

		it('surfaces an error and re-throws when the write fails', async () => {
			vi.mocked(repo.updateImageBlob).mockRejectedValue(new Error('quota exceeded'));

			await expect(store.saveImageToGallery(new Blob(['x']), 's.png', 'g1', null)).rejects.toThrow('quota exceeded');
			expect(store.getState().error).toBe('quota exceeded');
		});
	});

	// --- Store plumbing ---

	describe('subscription', () => {
		it('notifies subscribers when state changes', () => {
			const listener = vi.fn();
			store.subscribe(listener);

			store.setSelectedFolder('f1');

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('does not notify when a setter is a no-op', () => {
			const listener = vi.fn();
			store.subscribe(listener);

			store.setSelectedFolder(null);
			store.setGallerySearchQuery('');
			store.clearError();

			expect(listener).not.toHaveBeenCalled();
		});

		it('stops notifying after unsubscribe', () => {
			const listener = vi.fn();
			const unsubscribe = store.subscribe(listener);

			store.setSelectedFolder('f1');
			unsubscribe();
			store.setSelectedFolder('f2');

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('keeps getState and subscribe identities stable', () => {
			expect(store.subscribe).toBe(store.subscribe);
			expect(store.getState).toBe(store.getState);
		});
	});
});
