import { saveImageFile } from '../utils/fileOps';
import { renderBlankItemToBlob, renderImageItemToBlob } from '../utils/itemRender';
import { ImageProcessor } from './ImageProcessor';
import { decodeImageFile } from './decode';
import type { EditorStore } from './EditorStore';
import type { GalleryStore } from './GalleryStore';
import type { AppStore } from './store';
import type { LoadFromFileOutcome, OpenImageMeta, OpenItem } from './types';

/**
 * Cross-store operations.
 *
 * These existed as four hooks (`useSaveToGallery`, `useExportItem`,
 * `useImageLoader`, and inline gallery logic) purely because contexts cannot
 * depend on each other: `EditorStore` needed the gallery to save, and the export
 * path needed both plus a worker. With a single `AppStore` they are just methods.
 */
export class Commands {
	#editor: EditorStore;
	#gallery: GalleryStore;
	/** A dedicated worker, so exporting never cancels the preview's in-flight job. */
	#exportProcessor = new ImageProcessor();

	constructor(store: AppStore) {
		this.#editor = store.editor;
		this.#gallery = store.gallery;
	}

	dispose(): void {
		this.#exportProcessor.dispose();
	}

	// -------------------------------------------------------------------------
	// Opening
	// -------------------------------------------------------------------------

	/** Decodes a user-supplied file and opens it as an item. */
	openFile = async (file: File, meta: OpenImageMeta = {}): Promise<LoadFromFileOutcome> => {
		const result = await decodeImageFile(file);
		if (!result.ok) return result;
		await this.#editor.loadImage(result.image, file.name, meta);
		return { ok: true };
	};

	/** Opens a gallery entry in the editor, linking it so it stays restorable. */
	openGalleryImage = async (imageId: string): Promise<LoadFromFileOutcome> => {
		const { blob, fileName } = await this.#gallery.openGalleryImage(imageId);
		return this.openFile(new File([blob], fileName, { type: blob.type || 'image/png' }), {
			galleryImageId: imageId,
		});
	};

	// -------------------------------------------------------------------------
	// Saving
	// -------------------------------------------------------------------------

	/**
	 * Saves the active item's pixels into the gallery: overwriting its existing
	 * entry when it has one, otherwise creating one in `Unsorted` and relinking
	 * the item — which also makes it restorable.
	 */
	saveActiveItemToGallery = async (blob: Blob, fileName: string): Promise<void> => {
		const activeItemId = this.#editor.getState().activeItemId;
		if (activeItemId === null) return;
		const item = this.#editor.activeItem;
		if (!item) return;

		const galleryImageId = await this.#gallery.saveImageToGallery(blob, fileName, item.galleryImageId);
		this.#editor.linkGalleryImage(activeItemId, galleryImageId);
		this.#editor.markActiveSaved();
	};

	/** Saves any open item, activating it first because saving targets the active document. */
	saveOpenItem = async (item: OpenItem): Promise<void> => {
		const blob = await this.renderItemToBlob(item);
		if (!blob) return;
		if (this.#editor.getState().activeItemId !== item.id) this.#editor.activateItem(item.id);
		await this.saveActiveItemToGallery(blob, item.fileName || `${item.label}.png`);
	};

	// -------------------------------------------------------------------------
	// Exporting
	// -------------------------------------------------------------------------

	/**
	 * Renders an open item offscreen: filtered pixels for images, replayed strokes
	 * for blank canvases.
	 *
	 * Menu-driven Save and Export must work for *any* open item, so neither can
	 * read the live preview canvas — that only reflects the item on screen.
	 */
	renderItemToBlob = async (item: OpenItem): Promise<Blob | null> => {
		this.#exportProcessor.start();
		if (item.kind === 'blank') {
			return renderBlankItemToBlob(
				this.#editor.strokesByItem.get(item.id) ?? [],
				Math.max(this.#editor.getState().viewport.width, 1),
				Math.max(this.#editor.getState().viewport.height, 1),
			);
		}
		if (!item.image) return null;
		return renderImageItemToBlob(
			item.image,
			{ blur: item.blur, threshold: item.threshold, values: item.values },
			this.#exportProcessor.process,
		);
	};

	/** Downloads an open item as a file. */
	exportOpenItem = async (item: OpenItem): Promise<void> => {
		const blob = await this.renderItemToBlob(item);
		if (!blob) throw new Error('Nothing to export');
		await saveImageFile(blob, item.fileName || `${item.label}.png`);
	};

	/** Downloads a stored gallery image. */
	exportGalleryImage = async (galleryImageId: string, fileName: string): Promise<void> => {
		const blob = await this.#gallery.getImageBlob(galleryImageId);
		if (!blob) throw new Error('Image blob not found');
		await saveImageFile(blob, fileName || 'image.png');
	};
}
