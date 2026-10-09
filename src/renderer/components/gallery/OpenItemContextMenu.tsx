import { useRef } from 'react';
import type { OpenItem } from '../../core/types';
import { useDismissable } from '../../react/useDismissable';
import { useMenuPosition } from '../../react/useMenuPosition';
import { MenuItem } from '../shared/MenuItem';

interface OpenItemContextMenuProps {
	item: OpenItem;
	anchorX: number;
	anchorY: number;
	/** Dismiss the menu. */
	onCloseMenu: () => void;
	/** Activate the item (what clicking the tile does). */
	onOpen: (item: OpenItem) => void;
	onCloseItem: (item: OpenItem) => void;
	onSave: (item: OpenItem) => void;
	onExport: (item: OpenItem) => void;
}

/**
 * Context menu for entries in the virtual "Auto" folder, which mirror the items
 * currently open in the editor. Deliberately a different menu from the gallery
 * image menu: these rows are live editor state, not stored files.
 */
const OpenItemContextMenu: React.FC<OpenItemContextMenuProps> = ({
	item,
	anchorX,
	anchorY,
	onCloseMenu,
	onOpen,
	onCloseItem,
	onSave,
	onExport,
}) => {
	const menuRef = useRef<HTMLDivElement>(null);

	useDismissable(menuRef, onCloseMenu);

	const position = useMenuPosition(anchorX, anchorY, menuRef);

	return (
		<div
			ref={menuRef}
			className='fixed z-[60] bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]'
			// Hidden until measured, so clamping to the viewport does not visibly jump.
			style={{
				left: position?.left ?? 0,
				top: position?.top ?? 0,
				visibility: position ? 'visible' : 'hidden',
			}}
			role='menu'
		>
			<MenuItem
				onClick={() => {
					onOpen(item);
					onCloseMenu();
				}}
			>
				Open
			</MenuItem>
			<MenuItem
				onClick={() => {
					onSave(item);
					onCloseMenu();
				}}
			>
				Save to gallery
			</MenuItem>
			<MenuItem
				onClick={() => {
					onExport(item);
					onCloseMenu();
				}}
			>
				Export as...
			</MenuItem>
			<div className='border-t border-slate-100 my-1' />
			<MenuItem
				tone='danger'
				onClick={() => {
					onCloseItem(item);
					onCloseMenu();
				}}
			>
				Close
			</MenuItem>
		</div>
	);
};

export { OpenItemContextMenu };
export default OpenItemContextMenu;
