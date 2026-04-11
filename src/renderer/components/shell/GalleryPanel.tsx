import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useImageContext } from '../../hooks/ImageContext';
import { useGalleryContext } from '../../hooks/GalleryContext';
import { useImageLoader, imageLoadErrorMessage } from '../../hooks/useImageLoader';
import type { GalleryFolder, GalleryImage } from '../../../shared/types';
import { UNSORTED_FOLDER_NAME } from '../../../shared/types';
import { UI } from '../../constants/ui';
import { Icon } from '../shared/Icon';
import {
	DeleteFolderDialog,
	EditTagsDialog,
	FolderContextMenu,
	RenameFolderDialog,
} from '../gallery/FolderContextMenu';
import { ImageContextMenu } from '../gallery/ImageContextMenu';

type FolderContextMenuState = {
	folder: GalleryFolder;
	x: number;
	y: number;
} | null;

type ImageContextMenuState = {
	image: GalleryImage;
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
		selectedFolderId,
		gallerySearchQuery,
		activeTab,
		loading,
		error,
		loadGallery,
		createFolder,
		renameFolder,
		deleteFolder,
		updateFolderTags,
		moveImage,
		copyImage,
		deleteImage,
		openGalleryImage,
		setSelectedFolder,
		setGallerySearchQuery,
		setActiveTab,
		clearError,
	} = useGalleryContext();

	const { loadFromPath } = useImageLoader();

	const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState>(null);
	const [imageContextMenu, setImageContextMenu] = useState<ImageContextMenuState>(null);
	const [dialog, setDialog] = useState<DialogState>(null);
	const [newFolderMode, setNewFolderMode] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const [newFolderError, setNewFolderError] = useState<string | null>(null);
	const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);
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
		setFolderContextMenu({ folder, x: e.clientX, y: e.clientY });
	};

	const handleImageContextMenu = (e: React.MouseEvent, image: GalleryImage) => {
		e.preventDefault();
		setImageContextMenu({ image, x: e.clientX, y: e.clientY });
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

	// Open a gallery image in the editor
	const handleOpenImage = useCallback(
		async (image: GalleryImage) => {
			try {
				setImageLoadingId(image.id);
				const result = await openGalleryImage(image.id);
				const outcome = await loadFromPath(result.path, result.fileSize);
				if (!outcome.ok) {
					const msg = imageLoadErrorMessage(outcome.error);
					console.error('Failed to open gallery image:', msg);
				}
			} catch (err) {
				console.error('Failed to open gallery image:', err);
			} finally {
				setImageLoadingId(null);
			}
		},
		[openGalleryImage, loadFromPath],
	);

	const handleMoveImage = useCallback(
		async (image: GalleryImage, targetFolderId: string) => {
			try {
				await moveImage(image.id, targetFolderId);
			} catch {
				// error surfaced via context
			}
		},
		[moveImage],
	);

	const handleCopyImage = useCallback(
		async (image: GalleryImage, targetFolderId: string) => {
			try {
				await copyImage(image.id, targetFolderId);
			} catch {
				// error surfaced via context
			}
		},
		[copyImage],
	);

	const handleDeleteImage = useCallback(
		async (image: GalleryImage) => {
			try {
				await deleteImage(image.id);
			} catch {
				// error surfaced via context
			}
		},
		[deleteImage],
	);

	// Memoised derived structures to avoid O(n) work on every render.
	// Must be called before any early return to satisfy the Rules of Hooks.
	const sortedFolders = useMemo(() => [...folders].sort((a, b) => a.sortOrder - b.sortOrder), [folders]);
	const folderNameMap = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
	const folderImageCount = useMemo(
		() =>
			images.reduce<Map<string, number>>((acc, img) => {
				acc.set(img.folderId, (acc.get(img.folderId) ?? 0) + 1);
				return acc;
			}, new Map()),
		[images],
	);

	// Images for the currently selected folder
	const selectedFolderImages = useMemo(() => {
		if (!selectedFolderId) return [];
		return images.filter((img) => img.folderId === selectedFolderId).sort((a, b) => b.addedAt - a.addedAt);
	}, [images, selectedFolderId]);

	const selectedFolder = useMemo(
		() => folders.find((f) => f.id === selectedFolderId) ?? null,
		[folders, selectedFolderId],
	);

	if (!panels.gallery) return null;

	const isSearching = gallerySearchQuery.trim().length > 0;

	// Render the image thumbnail grid (reused for folder view and search results)
	const renderImageGrid = (imgs: GalleryImage[], showFolderBadge: boolean) => (
		<div
			className='grid gap-1.5'
			style={{ gridTemplateColumns: `repeat(${UI.GALLERY.THUMBNAIL_COLS}, minmax(0, 1fr))` }}
		>
			{imgs.map((img) => {
				const isLoading = imageLoadingId === img.id;
				const folderName = showFolderBadge ? folderNameMap.get(img.folderId) : null;
				return (
					<button
						key={img.id}
						type='button'
						className={`relative rounded-lg overflow-hidden border transition-colors cursor-pointer text-left p-0 bg-transparent ${
							isLoading ? 'border-slate-400 opacity-60' : 'border-slate-200 hover:border-slate-400'
						}`}
						onClick={() => handleOpenImage(img)}
						onContextMenu={(e) => handleImageContextMenu(e, img)}
						aria-label={`Open ${img.fileName}`}
					>
						<img src={`gallery-thumb://${img.id}`} alt={img.fileName} className='w-full aspect-square object-cover' />
						{folderName && (
							<span className='absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/60 truncate px-1 py-0.5'>
								{folderName}
							</span>
						)}
						{isLoading && (
							<div className='absolute inset-0 flex items-center justify-center bg-white/40'>
								<span className='text-[10px] text-slate-600'>Loading...</span>
							</div>
						)}
					</button>
				);
			})}
		</div>
	);

	// Folder detail view (when a folder is selected)
	const renderFolderDetail = () => {
		if (!selectedFolder) return null;
		const count = selectedFolderImages.length;

		return (
			<div className='space-y-3'>
				{/* Header with back button */}
				<div className='flex items-center gap-2'>
					<button
						type='button'
						aria-label='Back to folders'
						onClick={() => setSelectedFolder(null)}
						className='text-slate-400 hover:text-slate-600 transition-colors'
					>
						<Icon name='arrow-left' size='sm' />
					</button>
					<p className='text-xs font-semibold text-slate-700 truncate flex-1'>{selectedFolder.name}</p>
					<span className='text-[10px] text-slate-400'>
						{count} image{count !== 1 ? 's' : ''}
					</span>
				</div>

				{/* Image grid */}
				{count > 0 ? (
					renderImageGrid(selectedFolderImages, false)
				) : (
					<p className='text-xs text-slate-400 py-4 text-center'>No images in this folder</p>
				)}
			</div>
		);
	};

	return (
		<>
			<div
				className='fixed top-0 right-0 bottom-8 bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col'
				style={{ width: UI.GALLERY.PANEL_WIDTH }}
			>
				{/* Header */}
				<div className='flex items-center justify-between px-4 py-2.5 border-b border-slate-100'>
					<span className='text-xs font-semibold text-slate-700'>Gallery</span>
					<button
						type='button'
						aria-label='Close gallery'
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
							{/* If a folder is selected, show folder detail view */}
							{selectedFolderId && !isSearching ? (
								renderFolderDetail()
							) : (
								<>
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
												aria-label='Clear search'
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
												renderImageGrid(filteredImages, true)
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
																className='relative group rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-colors cursor-pointer'
																onContextMenu={(e) => handleFolderContextMenu(e, folder)}
															>
																<button
																	type='button'
																	className='w-full text-left p-3 bg-transparent'
																	onClick={() => setSelectedFolder(folder.id)}
																	aria-label={`Open folder ${folder.name}`}
																>
																	<p className='text-xs font-medium text-slate-700 truncate'>{folder.name}</p>
																	<p className='text-[10px] text-slate-400 mt-0.5'>
																		{count} image{count !== 1 ? 's' : ''}
																	</p>
																</button>
																{folder.name !== UNSORTED_FOLDER_NAME && (
																	<button
																		type='button'
																		aria-label='Folder actions'
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
								</>
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

			{/* Folder context menu */}
			{folderContextMenu && (
				<FolderContextMenu
					folder={folderContextMenu.folder}
					anchorX={folderContextMenu.x}
					anchorY={folderContextMenu.y}
					onClose={() => setFolderContextMenu(null)}
					onRename={(folder) => setDialog({ type: 'rename', folder })}
					onEditTags={(folder) => setDialog({ type: 'editTags', folder })}
					onDelete={(folder) => setDialog({ type: 'delete', folder })}
				/>
			)}

			{/* Image context menu */}
			{imageContextMenu && (
				<ImageContextMenu
					image={imageContextMenu.image}
					folders={folders}
					anchorX={imageContextMenu.x}
					anchorY={imageContextMenu.y}
					onClose={() => setImageContextMenu(null)}
					onOpen={handleOpenImage}
					onMoveTo={handleMoveImage}
					onCopyTo={handleCopyImage}
					onDelete={handleDeleteImage}
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
