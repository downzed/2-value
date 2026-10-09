import { UI } from '../constants/ui';
import type { EditorStore } from './EditorStore';
import type { PanelId } from './types';

function isInputFocused(): boolean {
	const tag = document.activeElement?.tagName?.toLowerCase();
	return tag === 'input' || tag === 'textarea' || tag === 'select';
}

const PANEL_KEYS: Record<string, PanelId> = {
	'1': 'controls',
	'2': 'original',
	'3': 'timer',
	'4': 'gallery',
};

/**
 * All editor keyboard shortcuts, in one registry.
 *
 * A lifecycle class so binding and unbinding is explicit rather than implied by
 * a component's mount lifecycle.
 *
 * Note this deliberately does **not** cover Ctrl+N / Ctrl+O / Ctrl+S. Those live
 * in `BottomPanel` because they drive its hidden file input and status text.
 * Fully consolidating them means hoisting that status into a store, which is
 * Phase 4 work — see ARCHITECTURE.md.
 */
export class KeyboardCommands {
	#editor: EditorStore;
	#running = false;

	constructor(editor: EditorStore) {
		this.#editor = editor;
	}

	start(): void {
		if (this.#running) return;
		this.#running = true;
		window.addEventListener('keydown', this.#handleKeyDown);
	}

	stop(): void {
		if (!this.#running) return;
		this.#running = false;
		window.removeEventListener('keydown', this.#handleKeyDown);
	}

	get isRunning(): boolean {
		return this.#running;
	}

	#handleKeyDown = (e: KeyboardEvent): void => {
		const editor = this.#editor;
		const mod = e.ctrlKey || e.metaKey;

		// Ctrl+Z = Undo
		if (mod && !e.shiftKey && e.key === 'z') {
			e.preventDefault();
			if (editor.canUndo) editor.undo();
			return;
		}

		// Ctrl+Shift+Z = Redo
		if (mod && e.shiftKey && e.key === 'Z') {
			e.preventDefault();
			if (editor.canRedo) editor.redo();
			return;
		}

		// Alt+1..4 or Ctrl+1..4 = Toggle panels
		const panel = e.altKey || e.ctrlKey ? PANEL_KEYS[e.key] : undefined;
		if (panel) {
			e.preventDefault();
			editor.togglePanel(panel);
			return;
		}

		if (mod && e.key === '0') {
			e.preventDefault();
			if (editor.hasImage) editor.setFitMode('fit');
			return;
		}

		// Ctrl+= / +- = Zoom
		if (mod && (e.key === '=' || e.key === '+')) {
			e.preventDefault();
			if (editor.hasImage) editor.zoomIn();
			return;
		}
		if (mod && e.key === '-') {
			e.preventDefault();
			if (editor.hasImage) editor.zoomOut();
			return;
		}

		// h/j/k/l vim-style adjustment keybinds: no modifiers, no text field.
		if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
		if (isInputFocused()) return;
		if (!editor.hasImage) return;

		const item = editor.activeItem;
		if (!item) return;

		switch (e.key) {
			case 'h':
				e.preventDefault();
				editor.setBlur(Math.max(UI.FILTER.BLUR_MIN, item.blur - UI.FILTER.BLUR_STEP));
				break;
			case 'l':
				e.preventDefault();
				editor.setBlur(Math.min(UI.FILTER.BLUR_MAX, item.blur + UI.FILTER.BLUR_STEP));
				break;
			case 'j':
				e.preventDefault();
				editor.setThreshold(Math.max(UI.FILTER.THRESHOLD_MIN, item.threshold - UI.FILTER.THRESHOLD_STEP));
				break;
			case 'k':
				e.preventDefault();
				editor.setThreshold(Math.min(UI.FILTER.THRESHOLD_MAX, item.threshold + UI.FILTER.THRESHOLD_STEP));
				break;
			default:
				break;
		}
	};
}
