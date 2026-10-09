import type React from 'react';
import { Button } from './Button';

interface IconButtonProps {
	children: React.ReactNode;
	/**
	 * Receives the click event so callers can anchor a menu to the pointer.
	 * Zero-argument handlers are assignable to this.
	 */
	onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
	/** Doubles as the tooltip and the accessible name. */
	title: string;
	disabled?: boolean;
	/**
	 * `on` for a plain hoverable icon button, `pressed` when it carries an
	 * on/off state (see `IconToggle`, which adds the badge).
	 */
	tone?: 'on' | 'pressed';
	/**
	 * Palette. `light` is for the white floating panels and gallery chrome;
	 * `dark` is for the slate status bar, where the hover is lighter rather than
	 * darker.
	 */
	surface?: 'light' | 'dark';
	active?: boolean;
	className?: string;
}

/**
 * Borderless icon button in the floating panels and gallery chrome.
 *
 * The close buttons on `FloatingWidget` and `GalleryPanel`, the back arrows, the
 * search clear, the eye toggle and the zoom steppers all shared the same
 * `text-slate-400 hover:text-slate-600 transition-colors` treatment.
 */
export const IconButton: React.FC<IconButtonProps> = ({
	children,
	onClick,
	title,
	disabled,
	tone = 'on',
	surface = 'light',
	active = false,
	className,
}) => (
	<Button
		label={title}
		title={title}
		disabled={disabled}
		onClick={onClick}
		// Only a toggle carries pressed state; a plain icon button must not lie
		// about being one.
		pressed={tone === 'pressed' ? active : undefined}
		className={
			surface === 'dark'
				? `text-slate-400 hover:text-slate-200 ${className ?? ''}`
				: tone === 'pressed' && active
					? `text-slate-700 ${className ?? ''}`
					: `text-slate-400 hover:text-slate-600 ${className ?? ''}`
		}
	>
		{children}
	</Button>
);
