import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorSelector, useGallerySelector, useEditorStore, useGalleryStore } from '../../react/useStore';
import { decodeErrorMessage } from '../../core/decode';
import {
	byNewestFirst,
	bySortOrder,
	filterImages,
	selectActiveItemId,
	selectFolders,
	selectGalleryError,
	selectGalleryLoading,
	selectGallerySearchQuery,
	selectImages,
	selectItems,
	selectPanels,
	selectSelectedFolderId,
} from '../../core/selectors';
import type { GalleryFolder, GalleryImage } from '../../../shared/types';
import { UI } from '../../constants/ui';
import { Icon } from '../shared/Icon';
import { IconButton } from '../shared/IconButton';
import {
	DeleteFolderDialog,
	EditTagsDialog,
	FolderContextMenu,
	RenameFolderDialog,
} from '../gallery/FolderContextMenu';
import { ImageContextMenu } from '../gallery/ImageContextMenu';
import { GridTile, TileGrid } from '../gallery/GridTile';
import { FolderRow } from '../gallery/FolderRow';
import { NewFolderCard } from '../gallery/NewFolderCard';
import { NewFolderForm } from '../gallery/NewFolderForm';
import { OpenItemContextMenu } from '../gallery/OpenItemContextMenu';
import { RecentSuggestions } from '../gallery/RecentSuggestions';
import { SaveFolderPrompt } from '../gallery/SaveFolderPrompt';
import { useCommands } from '../../react/useCommands';
import { useThumbnailUrls } from '../../react/useThumbnailUrls';
import { useSaveFlow } from '../../react/useSaveFlow';
import type { OpenItem } from '../../core/types';

type FolderContextMenuState = {
	folder: GalleryFolder;
	x: number;
	y: number;
} | null;

type OpenItemContextMenuState = {
	item: OpenItem;
	x: number;
	y: number;
} | null;

type ImageContextMenuState = {
	image: GalleryImage;
	x: number;
	y: number;
} | null;

/**
 * Sentinel folder id for the virtual "Opened Items" folder. Deliberately not a
 * UUID so it can never collide with a real gallery folder id.
 */
const OPENED_ITEMS_ID = '__opened_items__';

type DialogState =
	| { type: 'rename'; folder: GalleryFolder }
	| { type: 'editTags'; folder: GalleryFolder }
	| { type: 'delete'; folder: GalleryFolder }
	| null;

const GalleryPanel: React.FC = () => {
	const editor = useEditorStore();
	const gallery = useGalleryStore();
	const commands = useCommands();
	const { requestSave, prompt: savePrompt } = useSaveFlow();
	const { setPanel, activateItem, closeItem } = editor;

	// Reactive slices. Editor state is only needed for the Opened Items listing;
	// everything else comes from the gallery store, so a filter slider no longer
	// re-renders the folder list.
	const items = useEditorSelector(selectItems);
	const activeItemId = useEditorSelector(selectActiveItemId);
	const panels = useEditorSelector(selectPanels);

	const folders = useGallerySelector(selectFolders);
	const images = useGallerySelector(selectImages);
	const selectedFolderId = useGallerySelector(selectSelectedFolderId);
	const gallerySearchQuery = useGallerySelector(selectGallerySearchQuery);
	const loading = useGallerySelector(selectGalleryLoading);
	const error = useGallerySelector(selectGalleryError);

	// Search matches file names across every folder, not just the selected one.
	const filteredImages = useMemo(() => filterImages(images, gallerySearchQuery), [images, gallerySearchQuery]);

	const {
		loadGallery,
		createFolder,
		renameFolder,
		deleteFolder,
		updateFolderTags,
		moveImage,
		copyImage,
		deleteImage,
		setSelectedFolder,
		setGallerySearchQuery,
		clearError,
		getThumbnailBlob,
	} = gallery;

	const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState>(null);
	const [imageContextMenu, setImageContextMenu] = useState<ImageContextMenuState>(null);
	const [openItemMenu, setOpenItemMenu] = useState<OpenItemContextMenuState>(null);
	const [openItemThumbs, setOpenItemThumbs] = useState<Record<string, string>>({});
	const [dialog, setDialog] = useState<DialogState>(null);
	// The form's name/error/in-flight state lives in NewFolderForm.
	const [newFolderMode, setNewFolderMode] = useState(false);
	const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);
	const newFolderInputRef = useRef<HTMLInputElement>(null);
	const thumbnailUrls = useThumbnailUrls(images, getThumbnailBlob);

	useEffect(() => {
		if (panels.gallery) {
			loadGallery();
			clearError();
		}
	}, [panels.gallery, loadGallery, clearError]);

	/* Recents render through RecentSuggestions; it decides for itself when to show. */

	useEffect(() => {
		if (newFolderMode) {
			newFolderInputRef.current?.focus();
		}
	}, [newFolderMode]);

	const handleFolderContextMenu = (e: React.MouseEvent, folder: GalleryFolder) => {
		e.preventDefault();
		setFolderContextMenu({ folder, x: e.clientX, y: e.clientY });
	};

	/**
	 * "..." button: anchor to the button itself rather than the pointer, so the
	 * menu hangs off the button the way the right-click menu hangs off the cursor.
	 */
	const handleFolderMenuButton = (e: React.MouseEvent, folder: GalleryFolder) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = e.currentTarget.getBoundingClientRect();
		setFolderContextMenu({ folder, x: rect.left, y: rect.bottom });
	};

	const handleImageContextMenu = (e: React.MouseEvent, image: GalleryImage) => {
		e.preventDefault();
		setImageContextMenu({ image, x: e.clientX, y: e.clientY });
	};

	// Create, then leave the form. Errors propagate to NewFolderForm, which owns
	// the inline error state.
	const handleCreateFolder = async (name: string) => {
		await createFolder(name);
		setNewFolderMode(false);
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
				const outcome = await commands.openGalleryImage(image.id);
				if (!outcome.ok) {
					console.error('Failed to open gallery image:', decodeErrorMessage(outcome.error));
				}
			} catch (err) {
				console.error('Failed to open gallery image:', err);
			} finally {
				setImageLoadingId(null);
			}
		},
		[commands],
	);

	// --- Auto folder (virtual list of currently open items) ---

	// Lazily generate a preview per open item; blank canvases render their strokes.
	// The command reads the strokes internally, so this component never touches
	// `strokesByItem`.
	const ensureOpenItemThumb = useCallback(
		async (item: OpenItem) => {
			if (openItemThumbs[item.id]) return;
			const url = await commands.renderItemPreview(item);
			if (!url) return;
			setOpenItemThumbs((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: url }));
		},
		[commands, openItemThumbs],
	);

	// Clicking a row takes the user back to that document.
	const handleOpenItemClick = useCallback((item: OpenItem) => activateItem(item.id), [activateItem]);

	const handleOpenItemMenu = useCallback(
		(e: React.MouseEvent, item: OpenItem) => {
			e.preventDefault();
			e.stopPropagation();
			setOpenItemMenu({ item, x: e.clientX, y: e.clientY });
			void ensureOpenItemThumb(item);
		},
		[ensureOpenItemThumb],
	);

	// Save works on any item, not just the visible one, so a non-active item is
	// re-rendered offscreen rather than read off the live preview canvas.
	const handleSaveOpenItem = useCallback(
		(item: OpenItem) => {
			requestSave(
				(folderId) => commands.saveOpenItem(item, folderId),
				// Already gallery-backed entries are overwritten in place.
				item.galleryImageId !== null,
			);
		},
		[commands, requestSave],
	);

	const handleCloseOpenItem = useCallback(
		(item: OpenItem) => {
			if (item.dirty && !window.confirm(`Close "${item.label}"? Unsaved changes will be lost.`)) return;
			closeItem(item.id);
		},
		[closeItem],
	);

	const handleExportOpenItem = useCallback(
		async (item: OpenItem) => {
			try {
				await commands.exportOpenItem(item);
			} catch (err) {
				console.error('Failed to export open item:', err);
			}
		},
		[commands],
	);

	const handleExportGalleryImage = useCallback(
		async (image: GalleryImage) => {
			try {
				await commands.exportGalleryImage(image.id, image.fileName);
			} catch (err) {
				console.error('Failed to export gallery image:', err);
			}
		},
		[commands],
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
	const sortedFolders = useMemo(() => [...folders].sort(bySortOrder), [folders]);
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
		return images.filter((img) => img.folderId === selectedFolderId).sort(byNewestFirst);
	}, [images, selectedFolderId]);

	const selectedFolder = useMemo(
		() => folders.find((f) => f.id === selectedFolderId) ?? null,
		[folders, selectedFolderId],
	);

	if (!panels.gallery) return null;

	const isSearching = gallerySearchQuery.trim().length > 0;

	// Render the image thumbnail grid
	const renderImageGrid = (imgs: GalleryImage[], showFolderBadge: boolean) => (
		<TileGrid>
			{imgs.map((img) => (
				<GridTile
					key={img.id}
					src={thumbnailUrls[img.id]}
					alt={img.fileName}
					ariaLabel={`Open ${img.fileName}`}
					caption={showFolderBadge ? folderNameMap.get(img.folderId) : null}
					loading={imageLoadingId === img.id}
					onClick={() => handleOpenImage(img)}
					onContextMenu={(e) => handleImageContextMenu(e, img)}
				/>
			))}
		</TileGrid>
	);

	// Grid of currently open items — the contents of the virtual Auto folder.
	const renderOpenItemsGrid = () => {
		if (items.length === 0) {
			return <p className='text-xs text-slate-400 py-4 text-center'>Nothing open</p>;
		}
		return (
			<TileGrid>
				{items.map((item) => (
					<GridTile
						key={item.id}
						src={openItemThumbs[item.id]}
						alt={item.label}
						ariaLabel={`Continue ${item.label}`}
						caption={item.label}
						selected={item.id === activeItemId}
						dot={item.dirty}
						onClick={() => handleOpenItemClick(item)}
						onContextMenu={(e) => handleOpenItemMenu(e, item)}
					/>
				))}
			</TileGrid>
		);
	};

	// Folder detail view (when a folder is selected)
	const renderFolderDetail = () => {
		if (!selectedFolder) return null;
		const count = selectedFolderImages.length;

		return (
			<div className='space-y-3'>
				{/* Header with back button */}
				<div className='flex items-center gap-2'>
					<IconButton onClick={() => setSelectedFolder(null)} title='Back to folders'>
						<Icon name='arrow-left' size='sm' />
					</IconButton>
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
				className='fixed top-8 right-0 bottom-0 bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col'
				style={{ width: UI.GALLERY.PANEL_WIDTH }}
			>
				{/* Header */}
				<div className='flex items-center justify-between px-4 py-2.5 border-b border-slate-100'>
					<span className='text-xs font-semibold text-slate-700'>Gallery</span>
					<IconButton onClick={() => setPanel('gallery', false)} title='Close gallery'>
						<Icon name='close' />
					</IconButton>
				</div>

				{/* Body */}
				<div className='flex-1 overflow-y-auto p-3 space-y-3'>
					{error && (
						<div className='text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2'>{error}</div>
					)}

					{/* If a folder is selected, show folder detail view */}
					{selectedFolderId === OPENED_ITEMS_ID && !isSearching ? (
						<div className='space-y-3'>
							<div className='flex items-center gap-2'>
								<IconButton onClick={() => setSelectedFolder(null)} title='Back to folders'>
									<Icon name='arrow-left' size='sm' />
								</IconButton>
								<p className='text-xs font-semibold text-slate-700 truncate flex-1'>Opened Items</p>
								<span className='text-[10px] text-slate-400'>
									{items.length} open item{items.length !== 1 ? 's' : ''}
								</span>
							</div>
							<p className='text-[10px] text-slate-400'>
								Items you currently have open. Click one to continue working on it.
							</p>
							{renderOpenItemsGrid()}
						</div>
					) : selectedFolderId && !isSearching ? (
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
									<IconButton
										onClick={() => setGallerySearchQuery('')}
										title='Clear search'
										className='absolute right-2 top-1/2 -translate-y-1/2'
									>
										&times;
									</IconButton>
								)}
							</div>

							{/* Search results or folder grid */}
							{isSearching ? null : (
								<RecentSuggestions
									images={images}
									openItemCount={items.length}
									thumbnailUrls={thumbnailUrls}
									onOpen={(id) => {
										void commands.openGalleryImage(id);
									}}
								/>
							)}

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
											<li className='relative rounded-lg border border-slate-300 bg-slate-100 hover:border-slate-500 hover:bg-slate-50 transition-colors'>
												<FolderRow
													emphasis='strong'
													title='Opened Items'
													subtitle={`${items.length} open item${items.length !== 1 ? 's' : ''}`}
													ariaLabel='Open Opened Items folder'
													onClick={() => setSelectedFolder(OPENED_ITEMS_ID)}
												/>
											</li>

											{sortedFolders.map((folder) => {
												const count = folderImageCount.get(folder.id) ?? 0;
												return (
													<li
														key={folder.id}
														className='relative group rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-colors cursor-pointer'
														onContextMenu={(e) => handleFolderContextMenu(e, folder)}
													>
														<FolderRow
															title={folder.name}
															subtitle={`${count} image${count !== 1 ? 's' : ''}`}
															ariaLabel={`Open folder ${folder.name}`}
															onClick={() => setSelectedFolder(folder.id)}
														/>
														<IconButton
															onClick={(e) => handleFolderMenuButton(e, folder)}
															title={`Actions for folder ${folder.name}`}
															className='absolute top-1 right-1 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity'
														>
															•••
														</IconButton>
													</li>
												);
											})}

											{/* New Folder card */}
											{newFolderMode ? (
												<NewFolderForm onCreate={handleCreateFolder} onCancel={() => setNewFolderMode(false)} />
											) : (
												<NewFolderCard onClick={() => setNewFolderMode(true)} />
											)}
										</ul>
									)}
								</div>
							)}
						</>
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

			<SaveFolderPrompt prompt={savePrompt} />

			{/* Open-item context menu (virtual Opened Items folder) */}
			{openItemMenu && (
				<OpenItemContextMenu
					item={openItemMenu.item}
					anchorX={openItemMenu.x}
					anchorY={openItemMenu.y}
					onCloseMenu={() => setOpenItemMenu(null)}
					onOpen={handleOpenItemClick}
					onCloseItem={handleCloseOpenItem}
					onSave={handleSaveOpenItem}
					onExport={handleExportOpenItem}
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
					onExport={handleExportGalleryImage}
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
