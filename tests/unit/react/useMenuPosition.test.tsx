import { render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { useMenuPosition } from '../../../src/renderer/react/useMenuPosition';
import { FolderContextMenu } from '../../../src/renderer/components/gallery/FolderContextMenu';
import type { GalleryFolder } from '../../../src/shared/types';

const folder: GalleryFolder = { id: 'f1', name: 'Refs', tags: [], createdAt: 0, sortOrder: 0 };

function setViewport(width: number, height: number) {
	Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
	Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true });
}

describe('useMenuPosition', () => {
	it('leaves an anchor comfortably inside the viewport alone', () => {
		setViewport(1200, 800);
		const { result } = renderHook(() => {
			const ref = useRef<HTMLElement>(null);
			return useMenuPosition(100, 200, ref);
		});
		expect(result.current).toEqual({ left: 100, top: 200 });
	});

	it('never renders off the left or top edge', () => {
		setViewport(1200, 800);
		const { result } = renderHook(() => {
			const ref = useRef<HTMLElement>(null);
			return useMenuPosition(-40, -90, ref);
		});
		expect(result.current).toEqual({ left: 8, top: 8 });
	});

	it('clamps against the right edge', () => {
		setViewport(500, 800);
		const { result } = renderHook(() => {
			const ref = useRef<HTMLElement>(null);
			return useMenuPosition(490, 100, ref);
		});
		// Falls back to 160px wide before measurement, so the right edge is honoured.
		expect(result.current?.left).toBe(500 - 160 - 8);
	});

	it('clamps against the bottom edge', () => {
		setViewport(1200, 300);
		const { result } = renderHook(() => {
			const ref = useRef<HTMLElement>(null);
			return useMenuPosition(100, 295, ref);
		});
		expect(result.current?.top).toBe(300 - 120 - 8);
	});
});

describe('FolderContextMenu', () => {
	it('renders all actions and stays visible once positioned', () => {
		setViewport(1200, 800);
		const { getByText } = render(
			<FolderContextMenu
				folder={folder}
				anchorX={50}
				anchorY={60}
				onClose={() => {}}
				onRename={() => {}}
				onEditTags={() => {}}
				onDelete={() => {}}
			/>,
		);

		expect(getByText('Rename')).toBeDefined();
		expect(getByText('Edit Tags')).toBeDefined();
		expect(getByText('Delete')).toBeDefined();
	});

	it('offers rename and delete for a folder named Unsorted', () => {
		setViewport(1200, 800);
		const legacy = { ...folder, name: 'Unsorted' };
		const { getByText } = render(
			<FolderContextMenu
				folder={legacy}
				anchorX={50}
				anchorY={60}
				onClose={() => {}}
				onRename={() => {}}
				onEditTags={() => {}}
				onDelete={() => {}}
			/>,
		);

		// Unsorted is no longer special-cased now that it is never auto-created.
		expect(getByText('Rename')).toBeDefined();
		expect(getByText('Delete')).toBeDefined();
	});

	it('is visible after the clamp pass rather than stuck hidden', () => {
		setViewport(1200, 800);
		const { container } = render(
			<FolderContextMenu
				folder={folder}
				anchorX={50}
				anchorY={60}
				onClose={() => {}}
				onRename={() => {}}
				onEditTags={() => {}}
				onDelete={() => {}}
			/>,
		);
		expect((container.firstChild as HTMLElement).style.visibility).toBe('visible');
	});
});
