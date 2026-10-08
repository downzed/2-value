import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useUnsavedChangesGuard } from '../../../src/renderer/hooks/useUnsavedChangesGuard';

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

import { useImageContext } from '../../../src/renderer/hooks/ImageContext';

describe('useUnsavedChangesGuard', () => {
	beforeEach(() => {
		vi.mocked(useImageContext).mockReturnValue({ hasDirtyItems: false } as never);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('does not register a beforeunload listener when nothing is dirty', () => {
		const addSpy = vi.spyOn(window, 'addEventListener');
		renderHook(() => useUnsavedChangesGuard());
		const registered = addSpy.mock.calls.some(([type]) => type === 'beforeunload');
		expect(registered).toBe(false);
	});

	it('prevents unload while an item has unsaved changes', () => {
		vi.mocked(useImageContext).mockReturnValue({ hasDirtyItems: true } as never);
		renderHook(() => useUnsavedChangesGuard());

		const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it('removes the listener when the guard unmounts', () => {
		vi.mocked(useImageContext).mockReturnValue({ hasDirtyItems: true } as never);
		const { unmount } = renderHook(() => useUnsavedChangesGuard());

		unmount();
		const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
	});

	it('stops preventing unload once items are saved', () => {
		vi.mocked(useImageContext).mockReturnValue({ hasDirtyItems: true } as never);
		const { rerender } = renderHook(() => useUnsavedChangesGuard());

		vi.mocked(useImageContext).mockReturnValue({ hasDirtyItems: false } as never);
		rerender();

		const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});
});
