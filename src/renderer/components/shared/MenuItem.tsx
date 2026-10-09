import type React from 'react';
import { Button } from './Button';

interface MenuItemProps {
	children: React.ReactNode;
	onClick: () => void;
	/**
	 * `default` for ordinary actions, `danger` for destructive ones, `muted` for
	 * navigation that steps back out (a submenu's "Back").
	 */
	tone?: 'default' | 'danger' | 'muted';
	disabled?: boolean;
	/** Set when the surrounding element carries `role='menu'`. */
	role?: 'menuitem';
}

const TONES = {
	default: 'text-slate-700 hover:bg-slate-50',
	// One shade for every destructive row. The context menus previously mixed
	// text-red-500 and text-red-600 for the same intent; red-600 wins because two
	// of the three sites used it and the difference is imperceptible.
	danger: 'text-red-600 hover:bg-red-50',
	muted: 'text-slate-400 hover:text-slate-600 hover:bg-slate-50',
} as const;

/**
 * One row in a context menu.
 *
 * The four context menus (`FolderContextMenu`, `ImageContextMenu`,
 * `OpenItemContextMenu`, `FileMenu`) shared the same full-width left-aligned
 * `px-3 py-1.5 text-xs` row, differing only in colour and whether they disabled.
 */
export const MenuItem: React.FC<MenuItemProps> = ({ children, onClick, tone = 'default', disabled, role }) => (
	<Button
		block
		role={role}
		disabled={disabled}
		onClick={onClick}
		className={`px-3 py-1.5 text-xs disabled:hover:bg-transparent ${TONES[tone]}`}
	>
		{children}
	</Button>
);
