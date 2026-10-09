import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorSelector, useGallerySelector, useEditorStore, useGalleryStore } from '../../react/useStore';
import { decodeErrorMessage } from '../../core/decode';
import type { GalleryFolder, GalleryImage } from '../../../shared/types';
import { UI } from '../../constants/ui';
import { Icon } from '../shared/Icon';
import {
	DeleteFolderDialog,
	EditTagsDialog,
	FolderContextMenu,
	RenameFolderDialog,
} from '../gallery/FolderContextMenu';
import { ImageContextMenu } from '../gallery/ImageContextMenu';
import { OpenItemContextMenu } from '../gallery/OpenItemContextMenu';
import { useCommands } from '../../react/useCommands';
import { useSaveFlow } from '../../react/useSaveFlow';
import { renderImageThumbnail, renderStrokesThumbnail } from '../../utils/thumbnails';
import type { OpenItem } from '../../core/types';
import { getRecents, RECENTS_MAX } from '../../utils/storage';
import { galleryRepository } from '../../utils/storage';

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
	const { requestSave, dialog: saveDialog } = useSaveFlow();
	const { setPanel, activateItem, closeItem, strokesByItem } = editor;

	// Reactive slices. Editor state is only needed for the Auto folder listing;
	// everything else comes from the gallery store, so a filter slider no longer
	// re-renders the folder list.
	const items = useEditorSelector((s) => s.items);
	const activeItemId = useEditorSelector((s) => s.activeItemId);
	const viewport = useEditorSelector((s) => s.viewport);
	const panels = useEditorSelector((s) => s.panels);

	const folders = useGallerySelector((s) => s.folders);
	const images = useGallerySelector((s) => s.images);
	const selectedFolderId = useGallerySelector((s) => s.selectedFolderId);
	const gallerySearchQuery = useGallerySelector((s) => s.gallerySearchQuery);
	const loading = useGallerySelector((s) => s.loading);
	const error = useGallerySelector((s) => s.error);

	// Search matches file names across every folder, not just the selected one.
	const filteredImages = useMemo(() => {
		const q = gallerySearchQuery.trim().toLowerCase();
		if (!q) return images;
		return images.filter((img) => img.fileName.toLowerCase().includes(q));
	}, [images, gallerySearchQuery]);

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
	} = gallery;

	const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState>(null);
	const [imageContextMenu, setImageContextMenu] = useState<ImageContextMenuState>(null);
	const [openItemMenu, setOpenItemMenu] = useState<OpenItemContextMenuState>(null);
	const [openItemThumbs, setOpenItemThumbs] = useState<Record<string, string>>({});
	const [dialog, setDialog] = useState<DialogState>(null);
	const [newFolderMode, setNewFolderMode] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const [newFolderError, setNewFolderError] = useState<string | null>(null);
	const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);
	const newFolderInputRef = useRef<HTMLInputElement>(null);
	const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
	const prevImageIdsRef = useRef<string[]>([]);

	useEffect(() => {
		if (panels.gallery) {
			loadGallery();
			clearError();
		}
	}, [panels.gallery, loadGallery, clearError]);

	// Suggestions for what to open next, shown only while nothing is open.
	// Entries whose gallery image has since been deleted are filtered out.
	const recentEntries = useMemo(
		() =>
			items.length === 0
				? getRecents()
						.filter((entry) => images.some((i) => i.id === entry.galleryImageId))
						.slice(0, RECENTS_MAX)
				: [],
		[images, items],
	);

	const showRecents = recentEntries.length > 0 && gallerySearchQuery.trim().length === 0;

	useEffect(() => {
		if (newFolderMode) {
			newFolderInputRef.current?.focus();
		}
	}, [newFolderMode]);

	// Load thumbnail blobs from IndexedDB when images change
	useEffect(() => {
		const prevIds = new Set(prevImageIdsRef.current);
		const newImages = images.filter((i) => !prevIds.has(i.id));
		const removedIds = prevImageIdsRef.current.filter((id) => !images.some((i) => i.id === id));

		// Revoke URLs for removed images via functional state update
		if (removedIds.length > 0) {
			setThumbnailUrls((prev) => {
				const next = { ...prev };
				for (const id of removedIds) {
					if (next[id]) {
						URL.revokeObjectURL(next[id]);
						delete next[id];
					}
				}
				return next;
			});
		}

		if (newImages.length === 0) return;

		let cancelled = false;
		const newUrls: Record<string, string> = {};

		Promise.all(
			newImages.map(async (img) => {
				try {
					const blob = await galleryRepository.getThumbnailBlob(img.id);
					if (blob && !cancelled) {
						newUrls[img.id] = URL.createObjectURL(blob);
					}
				} catch {
					// thumbnail unavailable
				}
			}),
		).then(() => {
			if (!cancelled) {
				prevImageIdsRef.current = images.map((i) => i.id);
				setThumbnailUrls((prev) => ({ ...prev, ...newUrls }));
			}
		});

		return () => {
			cancelled = true;
			for (const url of Object.values(newUrls)) {
				URL.revokeObjectURL(url);
			}
		};
	}, [images]);

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
	const ensureOpenItemThumb = useCallback(
		async (item: OpenItem) => {
			if (openItemThumbs[item.id]) return;
			const url =
				item.kind === 'blank'
					? await renderStrokesThumbnail(
							strokesByItem.get(item.id) ?? [],
							Math.max(viewport.width, 1),
							Math.max(viewport.height, 1),
						)
					: item.image
						? await renderImageThumbnail(item.image)
						: null;
			if (!url) return;
			setOpenItemThumbs((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: url }));
		},
		[openItemThumbs, strokesByItem, viewport.width, viewport.height],
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

	// Render the image thumbnail grid
	const renderImageGrid = (imgs: GalleryImage[], showFolderBadge: boolean) => (
		<div
			className='grid gap-1.5'
			style={{ gridTemplateColumns: `repeat(${UI.GALLERY.THUMBNAIL_COLS}, minmax(0, 1fr))` }}
		>
			{imgs.map((img) => {
				const isLoading = imageLoadingId === img.id;
				const folderName = showFolderBadge ? folderNameMap.get(img.folderId) : null;
				const thumbUrl = thumbnailUrls[img.id];
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
						{thumbUrl ? (
							<img src={thumbUrl} alt={img.fileName} className='w-full aspect-square object-cover' />
						) : (
							<div className='w-full aspect-square bg-slate-100 animate-pulse' />
						)}
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

	// Grid of currently open items — the contents of the virtual Auto folder.
	const renderOpenItemsGrid = () => {
		if (items.length === 0) {
			return <p className='text-xs text-slate-400 py-4 text-center'>Nothing open</p>;
		}
		return (
			<div
				className='grid gap-1.5'
				style={{ gridTemplateColumns: `repeat(${UI.GALLERY.THUMBNAIL_COLS}, minmax(0, 1fr))` }}
			>
				{items.map((item) => {
					const isActive = item.id === activeItemId;
					const thumbUrl = openItemThumbs[item.id];
					return (
						<button
							key={item.id}
							type='button'
							className={`relative rounded-lg overflow-hidden border transition-colors cursor-pointer text-left p-0 bg-transparent ${
								isActive ? 'border-slate-500 ring-1 ring-slate-400' : 'border-slate-200 hover:border-slate-400'
							}`}
							onClick={() => handleOpenItemClick(item)}
							onContextMenu={(e) => handleOpenItemMenu(e, item)}
							aria-label={`Continue ${item.label}`}
						>
							{thumbUrl ? (
								<img src={thumbUrl} alt={item.label} className='w-full aspect-square object-cover' />
							) : (
								<div className='w-full aspect-square bg-slate-100 animate-pulse' />
							)}
							<span className='absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/60 truncate px-1 py-0.5'>
								{item.label}
							</span>
							{item.dirty && <span className='absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500' />}
						</button>
					);
				})}
			</div>
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

				{/* Body */}
				<div className='flex-1 overflow-y-auto p-3 space-y-3'>
					{error && (
						<div className='text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2'>{error}</div>
					)}

					{/* If a folder is selected, show folder detail view */}
					{selectedFolderId === OPENED_ITEMS_ID && !isSearching ? (
						<div className='space-y-3'>
							<div className='flex items-center gap-2'>
								<button
									type='button'
									aria-label='Back to folders'
									onClick={() => setSelectedFolder(null)}
									className='text-slate-400 hover:text-slate-600 transition-colors'
								>
									<Icon name='arrow-left' size='sm' />
								</button>
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

							{/* Recent suggestions, shown when nothing is open yet */}
							{showRecents && (
								<div className='mb-4 space-y-1.5'>
									<p className='text-[10px] font-medium text-slate-500 uppercase tracking-wide'>Recent</p>
									<div
										className='grid gap-1.5'
										style={{ gridTemplateColumns: `repeat(${UI.GALLERY.THUMBNAIL_COLS}, minmax(0, 1fr))` }}
									>
										{recentEntries.map((entry) => (
											<button
												key={entry.galleryImageId}
												type='button'
												onClick={() => {
													void commands.openGalleryImage(entry.galleryImageId);
												}}
												title={entry.fileName}
												className='relative rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors cursor-pointer p-0 bg-transparent'
											>
												{thumbnailUrls[entry.galleryImageId] ? (
													<img
														src={thumbnailUrls[entry.galleryImageId]}
														alt={entry.fileName}
														className='w-full aspect-square object-cover'
													/>
												) : (
													<div className='w-full aspect-square bg-slate-100' />
												)}
												<span className='absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/60 truncate px-1 py-0.5'>
													{entry.fileName}
												</span>
											</button>
										))}
									</div>
								</div>
							)}

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
											<li className='relative rounded-lg border border-slate-300 bg-slate-100 hover:border-slate-500 hover:bg-slate-50 transition-colors'>
												<button
													type='button'
													className='w-full text-left p-3 bg-transparent'
													onClick={() => setSelectedFolder(OPENED_ITEMS_ID)}
													aria-label='Open Opened Items folder'
												>
													<p className='text-xs font-semibold text-slate-800 truncate'>Opened Items</p>
													<p className='text-[10px] text-slate-500 mt-0.5'>
														{items.length} open item{items.length !== 1 ? 's' : ''}
													</p>
												</button>
											</li>

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
														<button
															type='button'
															aria-label={`Actions for folder ${folder.name}`}
															onClick={(e) => handleFolderMenuButton(e, folder)}
															className='absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded'
														>
															•••
														</button>
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

			{saveDialog}

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
