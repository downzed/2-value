import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

const MARGIN = 8;
/** Fallback size before the menu has been measured, so the first clamp is close. */
const FALLBACK_WIDTH = 160;
const FALLBACK_HEIGHT = 120;

export interface MenuPosition {
	left: number;
	top: number;
}

/**
 * Keeps a context menu inside the viewport.
 *
 * Menus are anchored to the pointer (right-click) or to a trigger element (a
 * "..." button). Near the right or bottom edge the raw anchor would push the menu
 * off-screen, so the final position is clamped once the menu has been measured.
 *
 * Returns `null` on the first paint, before the menu has a size to clamp
 * against; render it hidden until then to avoid a visible jump.
 *
 * Takes primitives rather than a point object so the effect dependencies stay
 * stable — callers pass a fresh object literal on every render otherwise.
 */
export function useMenuPosition(
	anchorX: number,
	anchorY: number,
	menuRef: RefObject<HTMLElement | null>,
): MenuPosition | null {
	const [position, setPosition] = useState<MenuPosition | null>(null);

	useLayoutEffect(() => {
		const el = menuRef.current;
		const width = el?.offsetWidth || FALLBACK_WIDTH;
		const height = el?.offsetHeight || FALLBACK_HEIGHT;

		const maxLeft = Math.max(MARGIN, window.innerWidth - width - MARGIN);
		const maxTop = Math.max(MARGIN, window.innerHeight - height - MARGIN);

		const left = Math.min(Math.max(anchorX, MARGIN), maxLeft);
		const top = Math.min(Math.max(anchorY, MARGIN), maxTop);

		setPosition((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
	}, [anchorX, anchorY, menuRef]);

	return position;
}
