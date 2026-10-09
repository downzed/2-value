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

export default Modal;
