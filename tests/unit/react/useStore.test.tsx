import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { shallowEqual, useEditorSelector, useGallerySelector } from '../../../src/renderer/react/useStore';
import { getAppStore, resetAppStore } from '../../../src/renderer/core/store';

describe('shallowEqual', () => {
	it('treats identical values as equal', () => {
		expect(shallowEqual(1, 1)).toBe(true);
		expect(shallowEqual('a', 'a')).toBe(true);
	});

	it('compares object properties one level deep', () => {
		expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
		expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		expect(shallowEqual({ a: 1, b: undefined }, { a: 1 })).toBe(false);
	});

	it('handles arrays and null', () => {
		expect(shallowEqual([1, 2], [1, 2])).toBe(true);
		expect(shallowEqual([1, 2], [1, 3])).toBe(false);
		expect(shallowEqual(null, null)).toBe(true);
		expect(shallowEqual(null, {})).toBe(false);
	});

	it('returns false when only one side is an object', () => {
		expect(shallowEqual(1, {})).toBe(false);
	});
});

describe('useStore selectors', () => {
	beforeEach(() => {
		resetAppStore();
	});

	afterEach(() => {
		resetAppStore();
	});

	it('reads a slice of editor state', () => {
		const { result } = renderHook(() => useEditorSelector((s) => s.zoom));
		expect(result.current).toBe(1);
	});

	it('re-renders when the selected slice changes', () => {
		const { result } = renderHook(() => useEditorSelector((s) => s.zoom));

		act(() => {
			getAppStore().editor.setZoom(2);
		});

		expect(result.current).toBe(2);
	});

	it('does not re-render when an unrelated slice changes', () => {
		let renders = 0;
		const { result } = renderHook(() => {
			renders++;
			return useEditorSelector((s) => s.zoom);
		});
		const before = renders;

		// Panels are unrelated to zoom.
		act(() => {
			getAppStore().editor.setPanel('gallery', true);
		});

		expect(result.current).toBe(1);
		expect(renders).toBe(before);
	});

	it('tolerates a selector returning a fresh object with shallowEqual', () => {
		const { result } = renderHook(() =>
			useEditorSelector((s) => ({ zoom: s.zoom, items: s.items.length }), shallowEqual),
		);

		act(() => {
			getAppStore().editor.setPanel('timer', false);
		});
		expect(result.current.items).toBe(0);

		// Would loop without shallowEqual, since each read is a new object.
		act(() => {
			getAppStore().editor.setPanel('timer', true);
		});
		expect(result.current.zoom).toBe(1);
	});

	it('supports gallery selectors', () => {
		const { result } = renderHook(() => useGallerySelector((s) => s.images));

		expect(result.current).toEqual([]);
	});

	it('unsubscribes on unmount', () => {
		const unsubscribe = vi.fn();
		const store = getAppStore().editor;
		const original = store.subscribe;
		// Count subscriptions by wrapping the real one.
		let live = 0;
		vi.spyOn(store, 'subscribe').mockImplementation(((listener: () => void) => {
			live++;
			const off = original(listener);
			return () => {
				live--;
				off();
				unsubscribe();
			};
		}) as never);

		const { unmount } = renderHook(() => useEditorSelector((s) => s.zoom));
		expect(live).toBe(1);

		unmount();
		expect(live).toBe(0);
	});

	it('renders a component that only reads a slice without extra updates', () => {
		function Zoom() {
			const zoom = useEditorSelector((s) => s.zoom);
			return <span>{zoom}</span>;
		}

		const { getByText } = render(<Zoom />);
		expect(getByText('1')).toBeDefined();

		act(() => {
			getAppStore().editor.setZoom(2);
		});
		expect(getByText('2')).toBeDefined();
	});
});
