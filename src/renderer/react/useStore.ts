import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { EditorStore } from '../core/EditorStore';
import type { GalleryState, GalleryStore } from '../core/GalleryStore';
import type { EditorState } from '../core/types';
import { getAppStore } from '../core/store';

interface Subscribable<S> {
	subscribe: (listener: () => void) => () => void;
	getState: () => S;
}

/**
 * Shallow equality for selectors that build a fresh object each call.
 *
 * Required whenever a selector returns a new object: `useSyncExternalStore`
 * compares snapshots with `Object.is` by default, so a fresh object every read
 * would loop forever.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;

	const keysA = Object.keys(a as Record<string, unknown>);
	const keysB = Object.keys(b as Record<string, unknown>);
	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
	}
	return true;
}

/**
 * Subscribes to an external store and re-renders only when the selected slice
 * changes.
 *
 * The snapshot is cached in a ref and only replaced when `isEqual` says it
 * differs, so a selector returning a new object each call is still safe when
 * paired with `shallowEqual`. Inline selectors are fine: a new `getSnapshot`
 * only costs a re-read, and `subscribe` identity is what governs resubscription.
 */
function useSelected<S, T>(store: Subscribable<S>, selector: (state: S) => T, isEqual: (a: T, b: T) => boolean): T {
	const cache = useRef<{ value: T } | null>(null);

	const getSnapshot = useCallback(() => {
		const next = selector(store.getState());
		const previous = cache.current;
		if (previous && isEqual(previous.value, next)) return previous.value;
		cache.current = { value: next };
		return next;
	}, [store, selector, isEqual]);

	return useSyncExternalStore(store.subscribe, getSnapshot);
}

/**
 * The editor store instance, for imperative reads and non-reactive members.
 *
 * `strokesByItem` and the action methods live here: they are stable, and must
 * never appear in a selector.
 */
export function useEditorStore(): EditorStore {
	return getAppStore().editor;
}

export function useGalleryStore(): GalleryStore {
	return getAppStore().gallery;
}

/** Subscribe to a slice of editor state. */
export function useEditorSelector<T>(selector: (state: EditorState) => T, isEqual?: (a: T, b: T) => boolean): T {
	return useSelected(getAppStore().editor, selector, isEqual ?? Object.is);
}

/** Subscribe to a slice of gallery state. */
export function useGallerySelector<T>(selector: (state: GalleryState) => T, isEqual?: (a: T, b: T) => boolean): T {
	return useSelected(getAppStore().gallery, selector, isEqual ?? Object.is);
}
