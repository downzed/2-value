import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnsavedGuard } from '../../../src/renderer/core/UnsavedGuard';
import { EditorStore } from '../../../src/renderer/core/EditorStore';

const image = () => ({ width: 10, height: 10 }) as never;

describe('UnsavedGuard', () => {
	let store: EditorStore;
	let guard: UnsavedGuard;
	let started: UnsavedGuard[] = [];

	beforeEach(() => {
		store = new EditorStore();
		guard = new UnsavedGuard(store);
		started = [];
	});

	afterEach(() => {
		// A guard left running keeps its window listener for the rest of the file,
		// which would make later beforeunload assertions pass for the wrong reason.
		for (const g of started) g.stop();
	});

	it('does not listen when nothing is dirty', () => {
		guard.start();
		started.push(guard);
		expect(guard.isAttached).toBe(false);
	});

	it('attaches once an item becomes dirty', async () => {
		await store.loadImage(image(), 'a.jpg');
		guard.start();
		started.push(guard);

		store.setBlur(2);

		expect(guard.isAttached).toBe(true);
	});

	it('prevents unload while dirty', async () => {
		await store.loadImage(image(), 'a.jpg');
		guard.start();
		started.push(guard);
		store.setBlur(2);

		const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it('detaches once the item is saved', async () => {
		await store.loadImage(image(), 'a.jpg');
		guard.start();
		started.push(guard);
		store.setBlur(2);
		expect(guard.isAttached).toBe(true);

		store.markActiveSaved();

		expect(guard.isAttached).toBe(false);
	});

	it('stops preventing unload after saving', async () => {
		await store.loadImage(image(), 'a.jpg');
		guard.start();
		started.push(guard);
		store.setBlur(2);
		store.markActiveSaved();

		const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
	});

	it('removes the listener on stop', async () => {
		await store.loadImage(image(), 'a.jpg');
		guard.start();
		started.push(guard);
		store.setBlur(2);

		guard.stop();

		expect(guard.isAttached).toBe(false);
		const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});

	it('ignores state changes after stop', async () => {
		await store.loadImage(image(), 'a.jpg');
		guard.start();
		started.push(guard);
		guard.stop();

		store.setBlur(2);

		expect(guard.isAttached).toBe(false);
	});

	it('is idempotent on repeated start', async () => {
		await store.loadImage(image(), 'a.jpg');
		guard.start();
		started.push(guard);
		guard.start();
		started.push(guard);
		store.setBlur(2);

		expect(guard.isAttached).toBe(true);
		guard.stop();
		expect(guard.isAttached).toBe(false);
	});
});
