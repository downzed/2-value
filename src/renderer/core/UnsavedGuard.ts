import type { EditorStore } from './EditorStore';

/**
 * Warns before the page unloads while any open item has unsaved changes.
 *
 * A lifecycle class rather than a hook so it can be started and stopped
 * explicitly. Browsers ignore the custom message and show their own generic
 * dialog, so `preventDefault()` plus `returnValue` is all that is available.
 */
export class UnsavedGuard {
	#editor: EditorStore;
	#running = false;
	#attached = false;

	constructor(editor: EditorStore) {
		this.#editor = editor;
	}

	start(): void {
		if (this.#running) return;
		this.#running = true;
		this.#editor.subscribe(() => this.#sync());
		this.#sync();
	}

	stop(): void {
		this.#running = false;
		if (this.#attached) {
			window.removeEventListener('beforeunload', this.#handleBeforeUnload);
			this.#attached = false;
		}
	}

	get isAttached(): boolean {
		return this.#attached;
	}

	#sync(): void {
		if (!this.#running) return;
		if (this.#editor.hasDirtyItems) {
			if (!this.#attached) {
				window.addEventListener('beforeunload', this.#handleBeforeUnload);
				this.#attached = true;
			}
			return;
		}
		if (this.#attached) {
			window.removeEventListener('beforeunload', this.#handleBeforeUnload);
			this.#attached = false;
		}
	}

	/** Bound so removeEventListener matches the same function reference. */
	#handleBeforeUnload = (e: BeforeUnloadEvent): void => {
		e.preventDefault();
		// Legacy browsers need returnValue set to trigger the prompt.
		e.returnValue = '';
	};
}
