import { act, renderHook } from '@testing-library/react';
import type { Image } from 'image-js';
import { describe, expect, it } from 'vitest';
import { useImage } from '../../../src/renderer/hooks/useImage';

const createMockImage = () => ({ width: 100, height: 100 }) as unknown as Image;

/**
 * The domain logic now lives in EditorStore and is tested in
 * tests/unit/core/EditorStore.test.ts. This covers only what the React binding
 * still does: project the snapshot and keep subscribers up to date.
 */
describe('useImage', () => {
	it('projects the store snapshot onto the legacy single-document shape', () => {
		const { result } = renderHook(() => useImage());

		expect(result.current.currentImage).toBe(null);
		expect(result.current.fileName).toBe('');
		expect(result.current.hasCanvas).toBe(false);
		expect(result.current.items).toEqual([]);
		expect(result.current.activeItemId).toBe(null);
		expect(result.current.blankCanvasId).toBe(null);
		expect(result.current.panels.gallery).toBe(false);
		expect(result.current.zoom).toBe(1);
	});

	it('re-renders when the underlying store changes', () => {
		const { result } = renderHook(() => useImage());

		act(() => {
			result.current.newBlankCanvas();
		});

		expect(result.current.canvasMode).toBe('blank');
		expect(result.current.hasBlankCanvas).toBe(true);
		expect(result.current.items).toHaveLength(1);
	});

	it('keeps strokesByItemRef referentially stable', () => {
		const { result, rerender } = renderHook(() => useImage());
		const first = result.current.strokesByItemRef;

		rerender();

		// Canvas has this in useCallback deps; a fresh object each render would
		// break its memoisation and repaint the surface every frame.
		expect(result.current.strokesByItemRef).toBe(first);
		expect(first.current).toBe(result.current.strokesByItemRef.current);
	});

	it('keeps action identities stable across renders', () => {
		const { result, rerender } = renderHook(() => useImage());
		const first = {
			newBlankCanvas: result.current.newBlankCanvas,
			setBlur: result.current.setBlur,
			setPanel: result.current.setPanel,
		};

		rerender();

		expect(result.current.newBlankCanvas).toBe(first.newBlankCanvas);
		expect(result.current.setBlur).toBe(first.setBlur);
		expect(result.current.setPanel).toBe(first.setPanel);
	});

	it('exposes currentImage and originalImage as the same object', async () => {
		const { result } = renderHook(() => useImage());
		const image = createMockImage();

		await act(async () => {
			await result.current.loadImage(image, 'photo.jpg');
		});

		expect(result.current.currentImage).toBe(image);
		expect(result.current.originalImage).toBe(image);
		expect(result.current.fileName).toBe('photo.jpg');
	});
});
