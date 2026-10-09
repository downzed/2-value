import { useEffect } from 'react';
import type { RefObject } from 'react';

interface DismissableOptions {
	/**
	 * A trigger that also counts as "inside" — used by dropdown menus, where a
	 * mousedown on the button that opened the menu must not close it before the
	 * click registers.
	 */
	ignoreRef?: RefObject<HTMLElement | null>;
	/**
	 * Element to focus when dismissed via Escape. Defaults to `ref`, but a
	 * dropdown should pass its trigger button, which is what the user was on.
	 */
	refocusRef?: RefObject<HTMLElement | null>;
	/** Called when the backdrop is clicked. Omit to ignore backdrop clicks. */
	onBackdropClick?: () => void;
}

/**
 * Dismisses an overlay on Escape and on an outside mousedown.
 *
 * `useMenuPosition` already owns the positioning half; this owns the dismissal
 * half, which was previously hand-rolled in five places in three shapes — and
 * `FolderPickerDialog` had the outside-click half missing entirely, so clicking
 * its backdrop did nothing while every menu dismissed.
 */
export function useDismissable(
	ref: RefObject<HTMLElement | null>,
	onClose: () => void,
	{ ignoreRef, refocusRef, onBackdropClick }: DismissableOptions = {},
): void {
	useEffect(() => {
		const isInside = (target: Node) =>
			ref.current?.contains(target) === true || ignoreRef?.current?.contains(target) === true;

		const handleMouseDown = (e: MouseEvent) => {
			const target = e.target as Node;
			if (isInside(target)) return;
			if (onBackdropClick) onBackdropClick();
			else onClose();
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.stopPropagation();
			onClose();
			(refocusRef ?? ref).current?.focus();
		};

		document.addEventListener('mousedown', handleMouseDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handleMouseDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [ref, ignoreRef, onClose, refocusRef, onBackdropClick]);
}
