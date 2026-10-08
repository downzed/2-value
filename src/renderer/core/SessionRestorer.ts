import { galleryRepository } from '../utils/storage';
import type { EditorStore } from './EditorStore';
import type { GalleryStore } from './GalleryStore';
import type { LoadFromFileOutcome, OpenImageMeta } from './types';

const DEFAULT_STORAGE_KEY = 'image-editor-open-items';

export interface SessionRestorerDeps {
	editor: EditorStore;
	gallery: GalleryStore;
	/** Decodes and opens a file. Injected so this class knows nothing about decoding. */
	openFile: (file: File, meta: OpenImageMeta) => Promise<LoadFromFileOutcome>;
	storageKey?: string;
	onError?: (message: string, error: unknown) => void;
}

function readPersistedIds(storageKey: string): string[] {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
	} catch {
		return [];
	}
}

/**
 * Restores the open-items list across reloads, and keeps it persisted.
 *
 * Only gallery-backed items are restorable — we hold their blobs in IndexedDB,
 * whereas a file opened from disk cannot be re-read without user permission,
 * and blank canvases have no bytes at all.
 *
 * Two ordering details this class exists to get right:
 *
 * 1. The persisted ids are snapshotted **before** anything writes to storage.
 *    Restoring later would read a list that a first-render persist had already
 *    overwritten with the current (empty) one.
 * 2. Persisting is held off until restoration has run, for the same reason.
 */
export class SessionRestorer {
	#editor: EditorStore;
	#gallery: GalleryStore;
	#openFile: SessionRestorerDeps['openFile'];
	#storageKey: string;
	#onError: (message: string, error: unknown) => void;

	#unsubscribeGallery: (() => void) | null = null;
	#unsubscribeEditor: (() => void) | null = null;
	#pendingIds: string[] | null = null;
	#restored = false;
	#running = false;

	constructor(deps: SessionRestorerDeps) {
		this.#editor = deps.editor;
		this.#gallery = deps.gallery;
		this.#openFile = deps.openFile;
		this.#storageKey = deps.storageKey ?? DEFAULT_STORAGE_KEY;
		this.#onError = deps.onError ?? ((message, error) => console.warn(message, error));
	}

	/** Subscribes to both stores. Idempotent. */
	start(): void {
		if (this.#running) return;
		this.#running = true;
		// Snapshot before the persist effect can overwrite the saved list.
		this.#pendingIds = readPersistedIds(this.#storageKey);

		this.#unsubscribeGallery = this.#gallery.subscribe(() => this.#onGalleryChanged());
		this.#unsubscribeEditor = this.#editor.subscribe(() => this.#persist());
		// The gallery may already be loaded, so check once rather than waiting
		// for the next notification.
		this.#onGalleryChanged();
	}

	stop(): void {
		this.#running = false;
		this.#unsubscribeGallery?.();
		this.#unsubscribeGallery = null;
		this.#unsubscribeEditor?.();
		this.#unsubscribeEditor = null;
	}

	get hasPendingIds(): boolean {
		return this.#pendingIds !== null;
	}

	/** Dirty items are already excluded from restorableItemIds, so this also prunes. */
	#persist(): void {
		if (!this.#restored) return;
		try {
			localStorage.setItem(this.#storageKey, JSON.stringify(this.#editor.restorableItemIds));
		} catch {
			// Storage unavailable (private mode / quota) — session-only is fine.
		}
	}

	#onGalleryChanged(): void {
		if (this.#restored) return;
		const { loading, images } = this.#gallery.getState();
		// Wait for the gallery so persisted ids resolve to real entries.
		if (loading || images.length === 0) return;

		const wanted = this.#pendingIds ?? [];
		this.#pendingIds = null;
		this.#restored = true;
		if (wanted.length === 0) {
			this.#persist();
			return;
		}

		void this.#reopen(wanted);
	}

	async #reopen(galleryImageIds: string[]): Promise<void> {
		for (const galleryImageId of galleryImageIds) {
			try {
				const { blob, fileName } = await this.#gallery.openGalleryImage(galleryImageId);
				const thumbBlob = await galleryRepository.getThumbnailBlob(galleryImageId);
				const thumbUrl = thumbBlob ? URL.createObjectURL(thumbBlob) : null;
				await this.#openFile(new File([blob], fileName), { galleryImageId, thumbUrl });
			} catch (error) {
				// Entry deleted or unreadable since the last session — skip it.
				this.#onError('Could not restore open item', error);
			}
		}
		this.#persist();
	}
}
