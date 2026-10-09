import type React from 'react';
import { useRef, useState } from 'react';
import type { GalleryFolder, GalleryImage } from '../../../shared/types';
import { useDismissable } from '../../react/useDismissable';
import { useMenuPosition } from '../../react/useMenuPosition';

interface ImageContextMenuProps {
	image: GalleryImage;
	folders: GalleryFolder[];
	anchorX: number;
	anchorY: number;
	onClose: () => void;
	onOpen: (image: GalleryImage) => void;
	onMoveTo: (image: GalleryImage, targetFolderId: string) => void;
	onCopyTo: (image: GalleryImage, targetFolderId: string) => void;
	onDelete: (image: GalleryImage) => void;
	/** Download the stored file. Saving/editing happens in the editor, not here. */
	onExport: (image: GalleryImage) => void;
}

type SubMenu = 'move' | 'copy' | null;

export const ImageContextMenu: React.FC<ImageContextMenuProps> = ({
	image,
	folders,
	anchorX,
	anchorY,
	onClose,
	onOpen,
	onMoveTo,
	onCopyTo,
	onDelete,
	onExport,
}) => {
	const menuRef = useRef<HTMLDivElement>(null);
	const [subMenu, setSubMenu] = useState<SubMenu>(null);

	// Escape peels back one level at a time before dismissing the menu.
	useDismissable(menuRef, () => (subMenu ? setSubMenu(null) : onClose()));

	// Folders the image can be moved/copied to (exclude current folder)
	const targetFolders = folders.filter((f) => f.id !== image.folderId).sort((a, b) => a.sortOrder - b.sortOrder);

	const renderFolderSubList = (action: 'move' | 'copy') => (
		<div className='border-t border-slate-100 py-1'>
			<p className='px-3 py-1 text-[10px] text-slate-400 uppercase tracking-wide'>
				{action === 'move' ? 'Move to' : 'Copy to'}
			</p>
			{targetFolders.length > 0 ? (
				targetFolders.map((folder) => (
					<button
						key={folder.id}
						type='button'
						className='w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors'
						onClick={() => {
							if (action === 'move') {
								onMoveTo(image, folder.id);
							} else {
								onCopyTo(image, folder.id);
							}
							onClose();
						}}
					>
						{folder.name}
					</button>
				))
			) : (
				<p className='px-3 py-1.5 text-xs text-slate-400'>No other folders</p>
			)}
			<button
				type='button'
				className='w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors'
				onClick={() => setSubMenu(null)}
			>
				Back
			</button>
		</div>
	);

	const position = useMenuPosition(anchorX, anchorY, menuRef);

	return (
		<div
			ref={menuRef}
			className='fixed z-[200] bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]'
			// Hidden until measured, so clamping to the viewport does not visibly jump.
			style={{
				left: position?.left ?? 0,
				top: position?.top ?? 0,
				visibility: position ? 'visible' : 'hidden',
			}}
		>
			{subMenu === null ? (
				<>
					<button
						type='button'
						className='w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors'
						onClick={() => {
							onOpen(image);
							onClose();
						}}
					>
						Open
					</button>
					<button
						type='button'
						className='w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors'
						onClick={() => setSubMenu('move')}
					>
						Move to...
					</button>
					<button
						type='button'
						className='w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors'
						onClick={() => setSubMenu('copy')}
					>
						Copy to...
					</button>
					<div className='border-t border-slate-100 my-1' />
					<button
						type='button'
						className='w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors'
						onClick={() => {
							onExport(image);
							onClose();
						}}
					>
						Export as...
					</button>
					<button
						type='button'
						className='w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors'
						onClick={() => {
							onDelete(image);
							onClose();
						}}
					>
						Delete
					</button>
				</>
			) : (
				renderFolderSubList(subMenu)
			)}
		</div>
	);
};
