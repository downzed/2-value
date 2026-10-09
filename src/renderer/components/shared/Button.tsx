import type React from 'react';

export interface ButtonProps {
	children: React.ReactNode;
	/** Receives the event so callers can anchor a menu to the pointer. */
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
	/** Defaults to `button`, so a dialog button can never post an unrelated form. */
	type?: 'button' | 'submit';
	/**
	 * Accessible name. Independent of `title` on purpose: most buttons here carry
	 * no tooltip, and defaulting one from the label would add one everywhere.
	 */
	label?: string;
	title?: string;
	/**
	 * Renders `aria-pressed`. Left undefined by default so an ordinary button does
	 * not claim to be a toggle; only pass it where the on/off state is real.
	 */
	pressed?: boolean;
	/** Only where a surrounding element carries `role='menu'`. */
	role?: 'menuitem';
	/** Full-width left-aligned row: context menus and folder cards. */
	block?: boolean;
	/**
	 * How a disabled button reads. `dim` is the default everywhere; `none` is for
	 * the few buttons that were never dimmed, and `faint` was one form's original
	 * opacity.
	 */
	disabledTone?: 'dim' | 'faint' | 'none';
	/** Shape and state classes, appended after the base ones. */
	className?: string;
}

const DISABLED_TONES = {
	dim: 'disabled:opacity-40 disabled:cursor-not-allowed',
	faint: 'disabled:opacity-50 disabled:cursor-not-allowed',
	none: '',
} as const;

/**
 * The one `<button>` in the app.
 *
 * Every wrapper below this — `MenuItem`, `DialogButton`, `IconButton`,
 * `IconToggle`, `PillButton`, `SegmentedControl`, `FolderRow`, `NewFolderCard`,
 * `GridTile` — supplies only its own shape and state classes. This owns the
 * plumbing they all repeated: the `type='button'` default, event forwarding, the
 * disabled treatment, the `label`/`title` pairing, the tri-state `aria-pressed`
 * (undefined means "not a toggle", which is what stops a plain button from
 * claiming to be one), and appending `className` without leaving a stray space.
 */
export const Button: React.FC<ButtonProps> = ({
	children,
	onClick,
	onContextMenu,
	disabled,
	type = 'button',
	label,
	title,
	pressed,
	role,
	block = false,
	disabledTone = 'dim',
	className,
}) => (
	<button
		type={type}
		onClick={onClick}
		onContextMenu={onContextMenu}
		disabled={disabled}
		role={role}
		aria-label={label}
		title={title}
		aria-pressed={pressed}
		className={['transition-colors', DISABLED_TONES[disabledTone], block ? 'w-full text-left' : '', className]
			.filter(Boolean)
			.join(' ')
			// Wrappers append their own optional className, which can leave a
			// trailing space. Trimming here keeps that from reaching the DOM.
			.trim()}
	>
		{children}
	</button>
);
