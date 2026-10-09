import { useEffect, useRef } from 'react';
import type { OpenItem } from '../../core/types';
import { useMenuPosition } from '../../react/useMenuPosition';

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

	useEffect(() => {
		const handleMouseDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCloseMenu();
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onCloseMenu();
		};
		document.addEventListener('mousedown', handleMouseDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handleMouseDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [onCloseMenu]);

	const itemClass = 'w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors';

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
			<button
				type='button'
				role='menuitem'
				className={itemClass}
				onClick={() => {
					onOpen(item);
					onCloseMenu();
				}}
			>
				Open
			</button>
			<button
				type='button'
				role='menuitem'
				className={itemClass}
				onClick={() => {
					onSave(item);
					onCloseMenu();
				}}
			>
				Save to gallery
			</button>
			<button
				type='button'
				role='menuitem'
				className={itemClass}
				onClick={() => {
					onExport(item);
					onCloseMenu();
				}}
			>
				Export as...
			</button>
			<div className='border-t border-slate-100 my-1' />
			<button
				type='button'
				role='menuitem'
				className={`${itemClass} text-red-500 hover:bg-red-50`}
				onClick={() => {
					onCloseItem(item);
					onCloseMenu();
				}}
			>
				Close
			</button>
		</div>
	);
};

export { OpenItemContextMenu };
export default OpenItemContextMenu;
