import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KeyboardCommands } from '../../../src/renderer/core/KeyboardCommands';
import { EditorStore } from '../../../src/renderer/core/EditorStore';
import { UI } from '../../../src/renderer/constants/ui';

const image = () => ({ width: 10, height: 10 }) as never;

describe('KeyboardCommands', () => {
	let store: EditorStore;
	let keyboard: KeyboardCommands;

	beforeEach(async () => {
		store = new EditorStore();
		keyboard = new KeyboardCommands(store);
		await store.loadImage(image(), 'a.jpg');
	});

	afterEach(() => {
		keyboard.stop();
	});

	it('does not bind until started', () => {
		expect(keyboard.isRunning).toBe(false);
		keyboard.start();
		expect(keyboard.isRunning).toBe(true);
	});

	it('is idempotent on repeated start', () => {
		keyboard.start();
		keyboard.start();
		store.togglePanel('controls');
		expect(store.getState().panels.controls).toBe(false);
	});

	it('toggles panels with Alt+1..4', () => {
		keyboard.start();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true }));
		window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true }));

		const panels = store.getState().panels;
		expect(panels.controls).toBe(false);
		expect(panels.original).toBe(false);
	});

	it('supports Ctrl+digit for panels', () => {
		keyboard.start();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', ctrlKey: true }));
		expect(store.getState().panels.gallery).toBe(true);
	});

	it('undoes and redoes adjustments', () => {
		keyboard.start();
		store.setBlur(4);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
		expect(store.activeItem?.blur).toBe(0);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true }));
		expect(store.activeItem?.blur).toBe(4);
	});

	it('does not undo when there is nothing to undo', () => {
		keyboard.start();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
		expect(store.activeItem?.blur).toBe(0);
	});

	it('applies vim-style blur steps with h and l', () => {
		keyboard.start();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
		expect(store.activeItem?.blur).toBe(UI.FILTER.BLUR_STEP);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
		expect(store.activeItem?.blur).toBe(0);
	});

	it('applies vim-style threshold steps with j and k', () => {
		keyboard.start();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
		expect(store.activeItem?.threshold).toBe(UI.FILTER.THRESHOLD_STEP);
	});

	it('clamps vim steps to the allowed range', () => {
		keyboard.start();
		store.setZoom(4);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
		expect(store.activeItem?.blur).toBe(UI.FILTER.BLUR_MIN);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
		expect(store.activeItem?.threshold).toBe(UI.FILTER.THRESHOLD_MIN);
	});

	it('zooms with Ctrl+= and Ctrl+-', () => {
		keyboard.start();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', ctrlKey: true }));
		expect(store.getState().zoom).toBeGreaterThan(1);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', ctrlKey: true }));
		expect(store.getState().zoom).toBe(1);
	});

	it('fits to view with Ctrl+0', () => {
		keyboard.start();
		store.setZoom(2);
		expect(store.getState().fitMode).toBe('manual');

		window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true }));
		expect(store.getState().fitMode).toBe('fit');
	});

	it('ignores vim keys while a text field is focused', () => {
		keyboard.start();
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));

		expect(store.activeItem?.blur).toBe(0);
		input.remove();
	});

	it('ignores vim keys when no image is open', () => {
		const empty = new EditorStore();
		const other = new KeyboardCommands(empty);
		other.start();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));

		expect(empty.getState().items).toHaveLength(0);
		other.stop();
	});

	it('stops handling keys after stop', () => {
		keyboard.start();
		keyboard.stop();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true }));

		expect(store.getState().panels.controls).toBe(true);
	});
});
