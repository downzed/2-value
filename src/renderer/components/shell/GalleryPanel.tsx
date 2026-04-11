import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '../../hooks/ImageContext';
import { useGalleryContext } from '../../hooks/GalleryContext';
import type { GalleryFolder } from '../../../shared/types';
import { Icon } from '../shared/Icon';
import {
	DeleteFolderDialog,
	EditTagsDialog,
	FolderContextMenu,
	RenameFolderDialog,
} from '../gallery/FolderContextMenu';

type ContextMenuState = {
	folder: GalleryFolder;
	x: number;
	y: number;
} | null;

type DialogState =
	| { type: 'rename'; folder: GalleryFolder }
	| { type: 'editTags'; folder: GalleryFolder }
	| { type: 'delete'; folder: GalleryFolder }
	| null;

const GalleryPanel: React.FC = () => {
	const { panels, setPanel } = useImageContext();
	const {
		folders,
		images,
		filteredImages,
		gallerySearchQuery,
		activeTab,
		loading,
		error,
		loadGallery,
		createFolder,
		renameFolder,
		deleteFolder,
		updateFolderTags,
		setGallerySearchQuery,
		setActiveTab,
		clearError,
	} = useGalleryContext();

	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [dialog, setDialog] = useState<DialogState>(null);
	const [newFolderMode, setNewFolderMode] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const [newFolderError, setNewFolderError] = useState<string | null>(null);
	const newFolderInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (panels.gallery) {
			loadGallery();
			clearError();
		}
	}, [panels.gallery, loadGallery, clearError]);

	useEffect(() => {
		if (newFolderMode) {
			newFolderInputRef.current?.focus();
		}
	}, [newFolderMode]);

	const handleFolderContextMenu = (e: React.MouseEvent, folder: GalleryFolder) => {
		e.preventDefault();
		setContextMenu({ folder, x: e.clientX, y: e.clientY });
	};

	const handleCreateFolder = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = newFolderName.trim();
		if (!name) return;
		try {
			setNewFolderError(null);
			await createFolder(name);
			setNewFolderName('');
			setNewFolderMode(false);
		} catch (err) {
			setNewFolderError(err instanceof Error ? err.message : 'Failed to create folder.');
		}
	};

	const handleRename = async (newName: string) => {
		if (dialog?.type !== 'rename') return;
		try {
			await renameFolder(dialog.folder.id, newName);
		} catch {
			// error surfaced via context
		} finally {
			setDialog(null);
		}
	};

	const handleEditTags = async (tags: string[]) => {
		if (dialog?.type !== 'editTags') return;
		try {
			await updateFolderTags(dialog.folder.id, tags);
		} catch {
			// error surfaced via context
		} finally {
			setDialog(null);
		}
	};

	const handleDelete = async (deleteImgs: boolean) => {
		if (dialog?.type !== 'delete') return;
		try {
			await deleteFolder(dialog.folder.id, deleteImgs);
		} catch {
			// error surfaced via context
		} finally {
			setDialog(null);
		}
	};

	if (!panels.gallery) return null;

	const isSearching = gallerySearchQuery.trim().length > 0;
	const sortedFolders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
	const folderNameMap = new Map(folders.map((f) => [f.id, f.name]));
	const folderImageCount = images.reduce<Map<string, number>>((acc, img) => {
		acc.set(img.folderId, (acc.get(img.folderId) ?? 0) + 1);
		return acc;
	}, new Map());

	return (
		<>
			<div className='fixed top-0 right-0 bottom-8 w-[380px] bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col'>
				{/* Header */}
				<div className='flex items-center justify-between px-4 py-2.5 border-b border-slate-100'>
					<span className='text-xs font-semibold text-slate-700'>Gallery</span>
					<button
						type='button'
						onClick={() => setPanel('gallery', false)}
						className='text-slate-400 hover:text-slate-600 transition-colors'
					>
						<Icon name='close' />
					</button>
				</div>

				{/* Tab bar */}
				<div className='flex border-b border-slate-100'>
					<button
						type='button'
						onClick={() => setActiveTab('folders')}
						className={`flex-1 py-2 text-xs font-medium transition-colors ${
							activeTab === 'folders'
								? 'text-slate-800 border-b-2 border-slate-800'
								: 'text-slate-400 hover:text-slate-600'
						}`}
					>
						Folders
					</button>
					<button
						type='button'
						onClick={() => setActiveTab('explore')}
						className={`flex-1 py-2 text-xs font-medium transition-colors ${
							activeTab === 'explore'
								? 'text-slate-800 border-b-2 border-slate-800'
								: 'text-slate-400 hover:text-slate-600'
						}`}
					>
						Explore
					</button>
				</div>

				{/* Body */}
				<div className='flex-1 overflow-y-auto'>
					{error && (
						<div className='m-3 text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2'>{error}</div>
					)}

					{activeTab === 'folders' && (
						<div className='p-3 space-y-3'>
							{/* Search bar */}
							<div className='relative'>
								<input
									type='text'
									value={gallerySearchQuery}
									onChange={(e) => setGallerySearchQuery(e.target.value)}
									placeholder='Search gallery...'
									className='w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-slate-400 bg-slate-50'
								/>
								{isSearching && (
									<button
										type='button'
										onClick={() => setGallerySearchQuery('')}
										className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
									>
										&times;
									</button>
								)}
							</div>

							{/* Search results or folder grid */}
							{isSearching ? (
								<div className='space-y-2'>
									<p className='text-[10px] text-slate-400'>
										{filteredImages.length} result{filteredImages.length !== 1 ? 's' : ''}
									</p>
									{filteredImages.length > 0 ? (
										<div className='grid grid-cols-3 gap-1.5'>
											{filteredImages.map((img) => {
												const folderName = folderNameMap.get(img.folderId) ?? '';
												return (
													<div
														key={img.id}
														className='relative rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors'
													>
														<img
															src={`gallery-thumb://${img.id}`}
															alt={img.fileName}
															className='w-full aspect-square object-cover'
														/>
														{folderName && (
															<span className='absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/60 truncate px-1 py-0.5'>
																{folderName}
															</span>
														)}
													</div>
												);
											})}
										</div>
									) : (
										<p className='text-xs text-slate-400 py-4 text-center'>No images found</p>
									)}
								</div>
							) : (
								<div className='space-y-2'>
									{loading && folders.length === 0 ? (
										<p className='text-xs text-slate-400 py-4 text-center'>Loading...</p>
									) : (
										<ul className='grid grid-cols-2 gap-2 list-none p-0 m-0'>
											{sortedFolders.map((folder) => {
												const count = folderImageCount.get(folder.id) ?? 0;
												return (
													<li
														key={folder.id}
														className='relative group rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-colors cursor-pointer p-3'
														onContextMenu={(e) => handleFolderContextMenu(e, folder)}
													>
														<p className='text-xs font-medium text-slate-700 truncate'>{folder.name}</p>
														<p className='text-[10px] text-slate-400 mt-0.5'>
															{count} image{count !== 1 ? 's' : ''}
														</p>
														{folder.name !== 'Unsorted' && (
															<button
																type='button'
																onClick={(e) => {
																	e.stopPropagation();
																	handleFolderContextMenu(e, folder);
																}}
																className='absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity rounded'
															>
																•••
															</button>
														)}
													</li>
												);
											})}

											{/* New Folder card */}
											{newFolderMode ? (
												<form
													onSubmit={handleCreateFolder}
													className='rounded-lg border border-slate-300 bg-slate-50 p-2 flex flex-col gap-1'
												>
													<input
														ref={newFolderInputRef}
														type='text'
														value={newFolderName}
														onChange={(e) => {
															setNewFolderName(e.target.value);
															setNewFolderError(null);
														}}
														placeholder='Folder name'
														maxLength={100}
														className='text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-slate-500 w-full'
														onKeyDown={(e) => {
															if (e.key === 'Escape') {
																setNewFolderMode(false);
																setNewFolderName('');
																setNewFolderError(null);
															}
														}}
													/>
													{newFolderError && <p className='text-[10px] text-red-500'>{newFolderError}</p>}
													<div className='flex gap-1'>
														<button
															type='submit'
															className='flex-1 text-[10px] bg-slate-800 text-white rounded py-1 hover:bg-slate-700 transition-colors'
														>
															Create
														</button>
														<button
															type='button'
															onClick={() => {
																setNewFolderMode(false);
																setNewFolderName('');
																setNewFolderError(null);
															}}
															className='flex-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors'
														>
															Cancel
														</button>
													</div>
												</form>
											) : (
												<button
													type='button'
													onClick={() => setNewFolderMode(true)}
													className='rounded-lg border border-dashed border-slate-300 bg-transparent hover:border-slate-400 hover:bg-slate-50 transition-colors p-3 text-left'
												>
													<p className='text-xs font-medium text-slate-400'>+ New Folder</p>
												</button>
											)}
										</ul>
									)}
								</div>
							)}
						</div>
					)}

					{activeTab === 'explore' && (
						<div className='p-3'>
							<p className='text-xs text-slate-400 py-8 text-center'>Explore coming soon</p>
						</div>
					)}
				</div>
			</div>

			{/* Context menu */}
			{contextMenu && (
				<FolderContextMenu
					folder={contextMenu.folder}
					anchorX={contextMenu.x}
					anchorY={contextMenu.y}
					onClose={() => setContextMenu(null)}
					onRename={(folder) => setDialog({ type: 'rename', folder })}
					onEditTags={(folder) => setDialog({ type: 'editTags', folder })}
					onDelete={(folder) => setDialog({ type: 'delete', folder })}
				/>
			)}

			{/* Dialogs */}
			{dialog?.type === 'rename' && (
				<RenameFolderDialog folder={dialog.folder} onConfirm={handleRename} onCancel={() => setDialog(null)} />
			)}
			{dialog?.type === 'editTags' && (
				<EditTagsDialog folder={dialog.folder} onConfirm={handleEditTags} onCancel={() => setDialog(null)} />
			)}
			{dialog?.type === 'delete' && (
				<DeleteFolderDialog
					folder={dialog.folder}
					imageCount={folderImageCount.get(dialog.folder.id) ?? 0}
					onConfirm={handleDelete}
					onCancel={() => setDialog(null)}
				/>
			)}
		</>
	);
};

export default GalleryPanel;
