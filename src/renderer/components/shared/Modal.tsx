import { useEffect, useId, useRef } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
	children: ReactNode;
	/** Width class for the card. */
	widthClass?: string;
	/**
	 * Dialog heading. Rendered as the card's visible `<h2>` and used as the
	 * accessible name, so callers do not repeat the string in a hidden element.
	 */
	title?: string;
	/** Overrides the accessible name when the visible heading is not descriptive enough. */
	ariaLabel?: string;
	/**
	 * Element to focus on open instead of the card itself. Defaults to the card,
	 * which is focusable via `tabIndex={-1}`.
	 */
	initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Backdrop + card shell shared by the app's dialogs.
 *
 * Was repeated four times; the Edit Tags copy had a malformed `z-300]` class that
 * silently swallowed `flex`, so this keeps one definition.
 *
 * The card carries `role='dialog'` and `aria-modal`, so assistive technology
 * treats it as a dialog instead of reading its contents as loose page text. The
 * backdrop is `aria-hidden` because it is presentational — dismissal by clicking
 * it is handled by `useDismissable`, not by anything inside it.
 */
const Modal: React.FC<ModalProps> = ({ children, widthClass = 'w-[360px]', title, ariaLabel, initialFocusRef }) => {
	const titleId = useId();
	const cardRef = useRef<HTMLDivElement>(null);

	// Focus moves in on open and returns on unmount. Doing it here rather than in
	// each dismissal path means Escape, a backdrop click and the dialog's own
	// buttons all restore focus identically.
	useEffect(() => {
		const previouslyFocused = document.activeElement as HTMLElement | null;
		(initialFocusRef?.current ?? cardRef.current)?.focus();

		return () => {
			// The trigger may itself be gone (e.g. the menu row that opened this),
			// so only restore focus when it is still in the document.
			if (previouslyFocused?.isConnected) previouslyFocused.focus();
		};
	}, [initialFocusRef]);

	/**
	 * Keeps Tab inside the dialog.
	 *
	 * `aria-modal` only tells assistive technology what the dialog *is*; nothing
	 * stops the browser's own tab order from walking into the page behind it.
	 *
	 * The listener is on `document` rather than the card so it still applies if
	 * focus has already escaped — a card-level handler would never see that Tab.
	 */
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Tab') return;

			const card = cardRef.current;
			if (!card) return;

			const focusable = getFocusable(card);
			if (focusable.length === 0) {
				// Nothing to move between; hold focus on the card.
				e.preventDefault();
				card.focus();
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement;

			if (!card.contains(active)) {
				// Focus has escaped; pull it back in rather than follow it out.
				e.preventDefault();
				(e.shiftKey ? last : first).focus();
				return;
			}

			// Focus may sit on the card itself (tabIndex={-1}); treat that as
			// "before the first control", so Tab steps in instead of wrapping.
			if (e.shiftKey && (active === card || active === first)) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);

	return (
		<div className='fixed inset-0 z-[300] flex items-center justify-center'>
			{/*
			 * A sibling of the card, not its wrapper: `aria-hidden` hides a whole
			 * subtree, so wrapping the dialog in it would hide the dialog too.
			 */}
			<div className='absolute inset-0 bg-black/40' aria-hidden='true' />
			<div
				ref={cardRef}
				role='dialog'
				aria-modal='true'
				aria-label={ariaLabel}
				aria-labelledby={ariaLabel ? undefined : titleId}
				// Focusable so focus can land on the dialog itself, which works even
				// when a dialog has no focusable children.
				tabIndex={-1}
				className={`relative bg-white rounded-xl shadow-2xl p-5 outline-none ${widthClass}`}
			>
				{title && (
					<h2 id={titleId} className='text-sm font-semibold text-slate-800'>
						{title}
					</h2>
				)}
				{children}
			</div>
		</div>
	);
};

/** Elements that can hold focus, in tab order, excluding hidden and disabled ones. */
const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
	if (!container) return [];
	// Deliberately not filtering on `offsetParent`: jsdom never lays out, so it
	// is always null and every element would be judged hidden.
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
	);
}

export default Modal;
