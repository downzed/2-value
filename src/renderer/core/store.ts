import { EditorStore } from './EditorStore';
import { GalleryStore } from './GalleryStore';
import { ImageProcessor } from './ImageProcessor';
import { Commands } from './commands';
import { galleryRepository } from '../utils/storage';

export interface AppStore {
	editor: EditorStore;
	gallery: GalleryStore;
	/** For preview rendering. Export uses its own instance so jobs can't cancel each other. */
	processor: ImageProcessor;
	/** Cross-store operations. One instance, so they share a single export worker. */
	commands: Commands;
}

export function createAppStore(): AppStore {
	const editor = new EditorStore();
	const gallery = new GalleryStore(galleryRepository);
	const processor = new ImageProcessor();
	processor.start();
	const store: AppStore = { editor, gallery, processor, commands: undefined as never };
	// Commands takes the store, so it is constructed once the shell exists.
	store.commands = new Commands(store);
	return store;
}

/**
 * The app's single store instance.
 *
 * A module singleton rather than context, because it removes the provider
 * ordering constraint that forced the four cross-store hooks to exist: contexts
 * cannot depend on each other, so `EditorStore` could never reach the gallery.
 *
 * Tests should construct their own via `createAppStore()` and pass it to the
 * hook bindings. Use `resetAppStore()` only when a test genuinely needs the
 * singleton (e.g. the keyboard/guard lifecycle classes).
 */
let current: AppStore = createAppStore();

export function getAppStore(): AppStore {
	return current;
}

/** Test-only: swaps in a fresh store and tears the old one down. */
export function resetAppStore(): AppStore {
	current.commands.dispose();
	current.editor.dispose();
	current.processor.dispose();
	current = createAppStore();
	return current;
}
