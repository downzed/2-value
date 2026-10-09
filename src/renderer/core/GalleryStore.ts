import type { GalleryFolder, GalleryImage } from '../../shared/types';
import type { Listener } from './types';

export interface GalleryState {
	folders: GalleryFolder[];
	images: GalleryImage[];
	selectedFolderId: string | null;
	gallerySearchQuery: string;
	loading: boolean;
	error: string | null;
}

export interface OpenImageResult {
	blob: Blob;
	fileName: string;
	fileSize: number;
}

/** The subset of the IndexedDB repository this store needs. */
export interface GalleryRepositoryPort {
	getData(): Promise<{ version: 1; folders: GalleryFolder[]; images: GalleryImage[] }>;
	createFolder(name: string, tags?: string[]): Promise<GalleryFolder>;
	renameFolder(folderId: string, newName: string): Promise<void>;
	deleteFolder(folderId: string, deleteImages: boolean): Promise<void>;
	updateFolderTags(folderId: string, tags: string[]): Promise<void>;
	importImage(file: File, folderId: string): Promise<GalleryImage>;
	updateImageBlob(imageId: string, blob: Blob): Promise<GalleryImage>;
	moveImage(imageId: string, targetFolderId: string): Promise<void>;
	copyImage(imageId: string, targetFolderId: string): Promise<GalleryImage>;
	deleteImage(imageId: string): Promise<void>;
	getImageBlob(imageId: string): Promise<Blob | undefined>;
}

function createInitialState(): GalleryState {
	return {
		folders: [],
		images: [],
		selectedFolderId: null,
		gallerySearchQuery: '',
		loading: false,
		error: null,
	};
}

/**
 * Gallery state as an external store, on top of the IndexedDB repository.
 *
 * The repository (`utils/storage.ts`) owns bytes; this owns observable state and
 * orchestration. Two behaviours worth knowing:
 *
 * - Every mutation re-reads the whole gallery via `getData()`. That is wasteful
 *   but it is the existing behaviour and deliberately unchanged here — fixing it
 *   belongs in its own change, not mixed into a structural refactor.
 * - Mutations share one `#runMutation` funnel, so the previous behaviour of
 *   clearing the error, reloading, and re-throwing the failure is defined once
 *   rather than repeated per operation.
 */
export class GalleryStore {
	#state: GalleryState = createInitialState();
	#listeners = new Set<Listener>();
	#repository: GalleryRepositoryPort;
	/** Guards against out-of-order `getData()` responses overwriting newer state. */
	#loadGeneration = 0;

	constructor(repository: GalleryRepositoryPort) {
		this.#repository = repository;
	}

	// -------------------------------------------------------------------------
	// Store plumbing
	// -------------------------------------------------------------------------

	getState = (): GalleryState => this.#state;

	/** Bound as an arrow property so the identity is stable across renders. */
	subscribe = (listener: Listener): (() => void) => {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	};

	#patch(fn: (state: GalleryState) => GalleryState): void {
		const next = fn(this.#state);
		if (next === this.#state) return;
		this.#state = next;
		for (const listener of [...this.#listeners]) listener();
	}

	// -------------------------------------------------------------------------
	// Derived values
	// -------------------------------------------------------------------------

	/** Search matches file names across every folder, not just the selected one. */
	get filteredImages(): GalleryImage[] {
		const q = this.#state.gallerySearchQuery.trim().toLowerCase();
		if (!q) return this.#state.images;
		return this.#state.images.filter((img) => img.fileName.toLowerCase().includes(q));
	}

	// -------------------------------------------------------------------------
	// Loading
	// -------------------------------------------------------------------------

	loadGallery = async (): Promise<void> => {
		const generation = ++this.#loadGeneration;
		try {
			// No-op only when already loading with no pending error.
			this.#patch((s) => (s.loading && s.error === null ? s : { ...s, loading: true, error: null }));
			const data = await this.#repository.getData();
			if (generation !== this.#loadGeneration) return;
			this.#patch((s) => ({ ...s, folders: data.folders, images: data.images, loading: false }));
		} catch {
			if (generation !== this.#loadGeneration) return;
			this.#patch((s) => ({ ...s, error: 'Failed to load gallery.', loading: false }));
		}
	};

	/**
	 * Shared mutation funnel: clear the error, run the write, reload, and on
	 * failure record a human-readable message and re-throw so callers can react.
	 */
	async #runMutation(operation: () => Promise<void>, fallbackMessage: string): Promise<void> {
		try {
			this.#patch((s) => (s.error === null ? s : { ...s, error: null }));
			await operation();
			await this.loadGallery();
		} catch (err) {
			const msg = err instanceof Error ? err.message : fallbackMessage;
			this.#patch((s) => ({ ...s, error: msg }));
			throw err;
		}
	}

	// -------------------------------------------------------------------------
	// Folders
	// -------------------------------------------------------------------------

	/** Returns the created folder so callers (e.g. the picker) can select it. */
	createFolder = async (name: string, tags?: string[]): Promise<GalleryFolder> => {
		let created!: GalleryFolder;
		await this.#runMutation(async () => {
			created = await this.#repository.createFolder(name, tags);
		}, 'Failed to create folder.');
		return created;
	};

	renameFolder = async (folderId: string, newName: string): Promise<void> =>
		this.#runMutation(() => this.#repository.renameFolder(folderId, newName), 'Failed to rename folder.');

	/** Deleting the selected folder returns the view to the folder grid. */
	deleteFolder = async (folderId: string, deleteImages: boolean): Promise<void> =>
		this.#runMutation(async () => {
			await this.#repository.deleteFolder(folderId, deleteImages);
			this.#patch((s) => ({
				...s,
				selectedFolderId: s.selectedFolderId === folderId ? null : s.selectedFolderId,
			}));
		}, 'Failed to delete folder.');

	updateFolderTags = async (folderId: string, tags: string[]): Promise<void> =>
		this.#runMutation(() => this.#repository.updateFolderTags(folderId, tags), 'Failed to update folder tags.');

	setSelectedFolder = (folderId: string | null): void => {
		this.#patch((s) => (s.selectedFolderId === folderId ? s : { ...s, selectedFolderId: folderId }));
	};

	setGallerySearchQuery = (query: string): void => {
		this.#patch((s) => (s.gallerySearchQuery === query ? s : { ...s, gallerySearchQuery: query }));
	};

	clearError = (): void => {
		this.#patch((s) => (s.error === null ? s : { ...s, error: null }));
	};

	// -------------------------------------------------------------------------
	// Images
	// -------------------------------------------------------------------------

	importImage = async (file: File, folderId: string): Promise<GalleryImage> => {
		let imported!: GalleryImage;
		await this.#runMutation(async () => {
			imported = await this.#repository.importImage(file, folderId);
		}, 'Failed to import image.');
		return imported;
	};

	/**
	 * Writes an image's pixels into the gallery and returns the entry id, so the
	 * caller can relink the open item.
	 *
	 * With an `existingImageId` the entry is overwritten in place, so repeated
	 * saves keep updating one image instead of piling up copies. Otherwise a new
	 * entry is created in `folderId` — there is no implicit destination, so the
	 * caller must choose one.
	 */
	saveImageToGallery = async (
		blob: Blob,
		fileName: string,
		existingImageId: string | null,
		folderId: string | null,
	): Promise<string> => {
		if (!existingImageId && !folderId) {
			throw new Error('A folder is required to save a new image');
		}
		let galleryImageId!: string;
		await this.#runMutation(async () => {
			if (existingImageId) {
				galleryImageId = (await this.#repository.updateImageBlob(existingImageId, blob)).id;
				return;
			}
			const created = await this.#repository.importImage(
				new File([blob], fileName, { type: blob.type || 'image/png' }),
				folderId as string,
			);
			galleryImageId = created.id;
		}, 'Failed to save image.');
		return galleryImageId;
	};

	moveImage = async (imageId: string, targetFolderId: string): Promise<void> =>
		this.#runMutation(() => this.#repository.moveImage(imageId, targetFolderId), 'Failed to move image.');

	copyImage = async (imageId: string, targetFolderId: string): Promise<void> =>
		this.#runMutation(
			() => this.#repository.copyImage(imageId, targetFolderId).then(() => undefined),
			'Failed to copy image.',
		);

	deleteImage = async (imageId: string): Promise<void> =>
		this.#runMutation(() => this.#repository.deleteImage(imageId), 'Failed to delete image.');

	/** Reads a gallery image's stored bytes, for exporting to a file. */
	getImageBlob = (imageId: string): Promise<Blob | undefined> => this.#repository.getImageBlob(imageId);

	/** Reads an image's bytes plus its metadata, for opening it in the editor. */
	openGalleryImage = async (imageId: string): Promise<OpenImageResult> => {
		this.#patch((s) => (s.error === null ? s : { ...s, error: null }));
		const blob = await this.#repository.getImageBlob(imageId);
		if (!blob) throw new Error('Image blob not found');
		const img = this.#state.images.find((i) => i.id === imageId);
		return {
			blob,
			fileName: img?.fileName ?? 'Unknown',
			fileSize: img?.fileSize ?? blob.size,
		};
	};
}
