import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { GalleryFolder } from '../../../shared/types';
import { useDismissable } from '../../react/useDismissable';
import Modal from '../shared/Modal';
import { DialogButton } from '../shared/DialogButton';
import { MenuItem } from '../shared/MenuItem';
import { useMenuPosition } from '../../react/useMenuPosition';

interface FolderContextMenuProps {
	folder: GalleryFolder;
	anchorX: number;
	anchorY: number;
	onClose: () => void;
	onRename: (folder: GalleryFolder) => void;
	onEditTags: (folder: GalleryFolder) => void;
	onDelete: (folder: GalleryFolder) => void;
}

export const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
	folder,
	anchorX,
	anchorY,
	onClose,
	onRename,
	onEditTags,
	onDelete,
}) => {
	const menuRef = useRef<HTMLDivElement>(null);

	useDismissable(menuRef, onClose);

	const position = useMenuPosition(anchorX, anchorY, menuRef);

	return (
		<div
			ref={menuRef}
			className='fixed z-[200] bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]'
			// Hidden until measured, so clamping to the viewport does not visibly jump.
			style={{
				left: position?.left ?? 0,
				top: position?.top ?? 0,
				visibility: position ? 'visible' : 'hidden',
			}}
		>
			<MenuItem
				onClick={() => {
					onRename(folder);
					onClose();
				}}
			>
				Rename
			</MenuItem>
			<MenuItem
				onClick={() => {
					onEditTags(folder);
					onClose();
				}}
			>
				Edit Tags
			</MenuItem>
			<div className='border-t border-slate-100 my-1' />
			<MenuItem
				tone='danger'
				onClick={() => {
					onDelete(folder);
					onClose();
				}}
			>
				Delete
			</MenuItem>
		</div>
	);
};

interface DeleteFolderDialogProps {
	folder: GalleryFolder;
	imageCount: number;
	onConfirm: (deleteImages: boolean) => void;
	onCancel: () => void;
}

export const DeleteFolderDialog: React.FC<DeleteFolderDialogProps> = ({ folder, imageCount, onConfirm, onCancel }) => {
	const [deleteImages, setDeleteImages] = useState(false);

	return (
		<Modal widthClass='w-[320px] space-y-4' title={`Delete "${folder.name}"?`}>
			{imageCount > 0 && (
				<div className='space-y-2'>
					<p className='text-xs text-slate-500'>
						This folder contains {imageCount} image
						{imageCount !== 1 ? 's' : ''}.
					</p>
					<label className='flex items-center gap-2 text-xs text-slate-700 cursor-pointer'>
						<input
							type='checkbox'
							checked={deleteImages}
							onChange={(e) => setDeleteImages(e.target.checked)}
							className='rounded'
						/>
						Delete images permanently
					</label>
					{!deleteImages && (
						<p className='text-xs text-slate-400'>
							Images move to another folder, or are deleted with the folder if it is the last one.
						</p>
					)}
				</div>
			)}
			<div className='flex justify-end gap-2'>
				<DialogButton variant='ghost' onClick={onCancel}>
					Cancel
				</DialogButton>
				<DialogButton variant='danger' onClick={() => onConfirm(deleteImages)}>
					Delete
				</DialogButton>
			</div>
		</Modal>
	);
};

interface RenameFolderDialogProps {
	folder: GalleryFolder;
	onConfirm: (newName: string) => void;
	onCancel: () => void;
}

export const RenameFolderDialog: React.FC<RenameFolderDialogProps> = ({ folder, onConfirm, onCancel }) => {
	const [name, setName] = useState(folder.name);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.select();
	}, []);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (trimmed) onConfirm(trimmed);
	};

	return (
		<Modal widthClass='w-[280px] space-y-3' title='Rename Folder'>
			<form onSubmit={handleSubmit} className='space-y-3'>
				<input
					ref={inputRef}
					type='text'
					value={name}
					onChange={(e) => setName(e.target.value)}
					className='w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-500'
					maxLength={100}
				/>
				<div className='flex justify-end gap-2'>
					<DialogButton variant='ghost' onClick={onCancel}>
						Cancel
					</DialogButton>
					<DialogButton variant='submit'>Rename</DialogButton>
				</div>
			</form>
		</Modal>
	);
};

interface EditTagsDialogProps {
	folder: GalleryFolder;
	onConfirm: (tags: string[]) => void;
	onCancel: () => void;
}

export const EditTagsDialog: React.FC<EditTagsDialogProps> = ({ folder, onConfirm, onCancel }) => {
	const [tagsInput, setTagsInput] = useState(folder.tags.join(', '));
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleSubmit = (e: React.SubmitEvent) => {
		e.preventDefault();
		const tags = tagsInput
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		onConfirm(tags);
	};

	return (
		<Modal widthClass='w-[300px] space-y-3' title={`Edit Tags — ${folder.name}`}>
			<p className='text-xs text-slate-400'>Tags help generate image suggestions. Separate with commas.</p>
			<form onSubmit={handleSubmit} className='space-y-3'>
				<input
					ref={inputRef}
					type='text'
					value={tagsInput}
					onChange={(e) => setTagsInput(e.target.value)}
					placeholder='nature, landscape, sunset...'
					className='w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-500'
				/>
				<div className='flex justify-end gap-2'>
					<DialogButton variant='ghost' onClick={onCancel}>
						Cancel
					</DialogButton>
					<DialogButton variant='submit'>Save</DialogButton>
				</div>
			</form>
		</Modal>
	);
};
