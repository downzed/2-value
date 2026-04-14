import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { GalleryFolder } from '../../../shared/types';
import { UNSORTED_FOLDER_NAME } from '../../../shared/types';

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

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose]);

	const isUnsorted = folder.name === UNSORTED_FOLDER_NAME;

	return (
		<div
			ref={menuRef}
			className='fixed z-[200] bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]'
			style={{ left: anchorX, top: anchorY }}
		>
			{!isUnsorted && (
				<button
					type='button'
					className='w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors'
					onClick={() => {
						onRename(folder);
						onClose();
					}}
				>
					Rename
				</button>
			)}
			<button
				type='button'
				className='w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors'
				onClick={() => {
					onEditTags(folder);
					onClose();
				}}
			>
				Edit Tags
			</button>
			{!isUnsorted && (
				<>
					<div className='border-t border-slate-100 my-1' />
					<button
						type='button'
						className='w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors'
						onClick={() => {
							onDelete(folder);
							onClose();
						}}
					>
						Delete
					</button>
				</>
			)}
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
		<div className='fixed inset-0 z-[300] flex items-center justify-center bg-black/40'>
			<div className='bg-white rounded-xl shadow-2xl p-5 w-[320px] space-y-4'>
				<h2 className='text-sm font-semibold text-slate-800'>Delete "{folder.name}"?</h2>
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
						{!deleteImages && <p className='text-xs text-slate-400'>Images will be moved to Unsorted.</p>}
					</div>
				)}
				<div className='flex justify-end gap-2'>
					<button
						type='button'
						onClick={onCancel}
						className='px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors'
					>
						Cancel
					</button>
					<button
						type='button'
						onClick={() => onConfirm(deleteImages)}
						className='px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
					>
						Delete
					</button>
				</div>
			</div>
		</div>
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
		<div className='fixed inset-0 z-[300] flex items-center justify-center bg-black/40'>
			<div className='bg-white rounded-xl shadow-2xl p-5 w-[280px] space-y-3'>
				<h2 className='text-sm font-semibold text-slate-800'>Rename Folder</h2>
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
						<button
							type='button'
							onClick={onCancel}
							className='px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors'
						>
							Cancel
						</button>
						<button
							type='submit'
							className='px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors'
						>
							Rename
						</button>
					</div>
				</form>
			</div>
		</div>
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
		<div className='fixed inset-0 z-300]flex items-center justify-center bg-black/40'>
			<div className='bg-white rounded-xl shadow-2xl p-5 w-300 space-y-3'>
				<h2 className='text-sm font-semibold text-slate-800'>Edit Tags — {folder.name}</h2>
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
						<button
							type='button'
							onClick={onCancel}
							className='px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors'
						>
							Cancel
						</button>
						<button
							type='submit'
							className='px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors'
						>
							Save
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
