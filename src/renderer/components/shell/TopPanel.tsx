import { useCallback, useEffect, useState } from 'react';
import { decodeErrorMessage } from '../../core/decode';
import {
	selectActiveFileName,
	selectActiveImage,
	selectActiveItem,
	selectEffectiveZoom,
	selectHasCanvas,
	selectHasGalleryEntry,
	selectIsBlank,
} from '../../core/selectors';
import { openImageFile } from '../../utils/fileOps';
import { useCommands } from '../../react/useCommands';
import { useSaveFlow } from '../../react/useSaveFlow';
import { useEditorSelector, useEditorStore, useGallerySelector, useGalleryStore } from '../../react/useStore';
import { FolderPickerDialog } from '../gallery/FolderPickerDialog';
import { SaveFolderPrompt } from '../gallery/SaveFolderPrompt';
import FileMenu from './FileMenu';
import { Icon } from '../shared/Icon';
import { IconButton } from '../shared/IconButton';
import { IconToggle } from '../shared/IconToggle';
import { SegmentedControl } from '../shared/SegmentedControl';

type Status = 'ready' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error';

/** The zoom steps the status bar offers as one-click presets. */
const ZOOM_PRESETS = ['fit', '1:1', '2x'] as const;
type ZoomPreset = (typeof ZOOM_PRESETS)[number];

interface PendingOpen {
	file: File;
}

interface TopPanelProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const TopPanel: React.FC<TopPanelProps> = ({ previewCanvasRef }) => {
	const editor = useEditorStore();
	const gallery = useGalleryStore();
	const commands = useCommands();
	const { requestSave, prompt: savePrompt } = useSaveFlow();

	// Non-reactive actions.
	const { newBlankCanvas, togglePanel, setFitMode, setZoom, zoomIn, zoomOut } = editor;
	const { importImage, createFolder } = gallery;

	// Reactive slices: editor state, then gallery state. Splitting these means a
	// gallery reload no longer re-renders the status bar's zoom readout, and a
	// slider drag does not touch the folder list.
	const hasImage = useEditorSelector((s) => s.items.some((i) => i.id === s.activeItemId && i.image !== null));
	const hasCanvas = useEditorSelector(selectHasCanvas);
	const hasBlankCanvas = useEditorSelector(selectIsBlank);
	const viewport = useEditorSelector((s) => s.viewport);
	const currentImage = useEditorSelector(selectActiveImage);
	const fileName = useEditorSelector(selectActiveFileName);
	const hasGalleryEntry = useEditorSelector(selectHasGalleryEntry);
	const activeItem = useEditorSelector(selectActiveItem);
	const panels = useEditorSelector((s) => s.panels);
	const counter = useEditorSelector((s) => s.counter);
	const counterRunning = useEditorSelector((s) => s.counterRunning);
	const counterDuration = useEditorSelector((s) => s.counterDuration);
	const zoom = useEditorSelector((s) => s.zoom);
	const fitMode = useEditorSelector((s) => s.fitMode);
	const effectiveZoom = useEditorSelector(selectEffectiveZoom);

	const folders = useGallerySelector((s) => s.folders);
	const [status, setStatus] = useState<Status>('ready');
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);

	// A blank canvas reports the stage size its backing store was sized to.
	const blankSize =
		hasBlankCanvas && viewport.width > 0 && viewport.height > 0
			? { width: Math.round(viewport.width), height: Math.round(viewport.height) }
			: null;

	const width = currentImage?.width ?? blankSize?.width ?? '--';
	const height = currentImage?.height ?? blankSize?.height ?? '--';

	const handleNew = useCallback(() => {
		setStatus('ready');
		setErrorMsg(null);
		newBlankCanvas();
	}, [newBlankCanvas]);

	const doLoadFromFile = useCallback(
		async (pending: PendingOpen) => {
			const outcome = await commands.openFile(pending.file);
			if (outcome.ok) {
				setStatus('loaded');
			} else {
				const msg = decodeErrorMessage(outcome.error);
				setErrorMsg(msg);
				setStatus('error');
				console.error('Image load rejected:', outcome.error);
			}
		},
		[commands],
	);

	// Downloads the active item to a real file. Saving to the gallery is separate.
	const handleExport = useCallback(async () => {
		if (!activeItem) return;
		try {
			await commands.exportOpenItem(activeItem);
		} catch (err) {
			setStatus('error');
			console.error('Failed to export image:', err);
		}
	}, [activeItem, commands]);

	const handleOpen = useCallback(async () => {
		try {
			setStatus('loading');
			setErrorMsg(null);
			const file = await openImageFile();
			if (file) {
				setPendingOpen({ file });
			} else {
				setStatus(hasImage ? 'loaded' : 'ready');
			}
		} catch (err) {
			setStatus('error');
			console.error('Failed to open image:', err);
		}
	}, [hasImage]);

	const handleFolderPickerSelect = useCallback(
		async (folderId: string) => {
			if (!pendingOpen) return;
			const { file } = pendingOpen;
			setPendingOpen(null);

			try {
				await importImage(file, folderId);
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Import failed';
				if (msg.includes('already in')) {
					console.warn('Duplicate detected, opening image anyway:', msg);
				} else {
					console.error('Import failed:', err);
				}
			}

			await doLoadFromFile({ file });
		},
		[pendingOpen, importImage, doLoadFromFile],
	);

	const handleFolderPickerSkip = useCallback(async () => {
		if (!pendingOpen) return;
		const { file } = pendingOpen;
		setPendingOpen(null);
		await doLoadFromFile({ file });
	}, [pendingOpen, doLoadFromFile]);

	// Routed through the gallery store so #runMutation records and rethrows
	// failures; calling the repository directly swallowed them.
	const handleCreateFolderInPicker = useCallback((name: string) => createFolder(name), [createFolder]);

	// Saves into the gallery, not to disk. Use "Export as..." on a gallery item
	// to download a file.
	const handleSave = useCallback(async () => {
		if (!hasCanvas || !previewCanvasRef.current) return;

		try {
			setStatus('saving');
			const canvas = previewCanvasRef.current;
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
			});
			const name = fileName || 'image.png';
			// An item that already has a gallery entry is overwritten in place;
			// otherwise the save flow asks which folder to put it in.
			requestSave((folderId) => commands.saveActiveItemToGallery(blob, name, folderId), hasGalleryEntry);
			setStatus('saved');
			setTimeout(() => setStatus('loaded'), 2000);
		} catch (error) {
			setStatus('error');
			console.error('Failed to save image:', error);
		}
	}, [previewCanvasRef, fileName, hasCanvas, commands, requestSave, hasGalleryEntry]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
				e.preventDefault();
				handleNew();
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
				e.preventDefault();
				handleOpen();
			} else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				if (hasCanvas) handleSave();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [hasCanvas, handleNew, handleOpen, handleSave]);

	const statusStyles: Record<Status, { text: string; className: string }> = {
		ready: { text: 'Ready', className: 'text-emerald-400' },
		loading: { text: 'Loading...', className: 'text-yellow-400' },
		loaded: { text: 'Image ready', className: 'text-emerald-400' },
		saving: { text: 'Saving...', className: 'text-yellow-400' },
		saved: { text: 'Saved!', className: 'text-blue-400' },
		error: { text: errorMsg ?? 'Error', className: 'text-red-400' },
	};

	/**
	 * Compact time for the panel-toggle badge: `45` under a minute, `3m` above.
	 *
	 * Deliberately not the same format as `FloatingCounter`'s `5:00` readout. The
	 * badge is a glanceable nudge inside a 24px icon button where seconds would be
	 * unreadable, so it is deliberately lossy rather than accidentally inconsistent.
	 */
	const formatBadge = (seconds: number): string => {
		if (seconds < 60) return `${seconds}`;
		return `${Math.floor(seconds / 60)}m`;
	};

	return (
		<>
			<div className='h-8 shrink-0 bg-slate-800 border-b border-slate-700 px-4 flex items-center text-xs text-slate-300'>
				{/* File operations live in a dropdown; the shortcuts stay on window. */}
				<div className='mr-4'>
					<FileMenu
						items={[
							{ id: 'new', label: 'New', shortcut: 'Ctrl+N', onSelect: handleNew },
							{ id: 'open', label: 'Open', shortcut: 'Ctrl+O', onSelect: handleOpen },
							{
								id: 'save',
								label: 'Save',
								shortcut: 'Ctrl+S',
								description: 'Write to the gallery',
								disabled: !hasCanvas,
								onSelect: handleSave,
							},
							{
								id: 'export',
								label: 'Export as...',
								description: 'Download a PNG or JPEG',
								disabled: !hasCanvas,
								onSelect: handleExport,
							},
						]}
					/>
				</div>

				<span className='w-px h-4 bg-slate-600 mr-4' />

				{/* File Info */}
				{fileName && (
					<>
						<span className='text-slate-100 font-medium'>{fileName}</span>
						<span className='mx-3 text-slate-500'>|</span>
					</>
				)}
				{width && height && (
					<span>
						{width} × {height}
					</span>
				)}

				<span className='flex-1' />

				{/* Panel toggles — always visible; the active one is highlighted. */}
				<div className='flex items-center gap-1 mr-3'>
					<IconToggle active={panels.controls} onClick={() => togglePanel('controls')} title='Adjustments (Alt+1)'>
						<Icon name='sliders' size='sm' />
					</IconToggle>
					<IconToggle active={panels.original} onClick={() => togglePanel('original')} title='Original (Alt+2)'>
						<Icon name='image' size='sm' />
					</IconToggle>
					<IconToggle
						active={panels.timer}
						onClick={() => togglePanel('timer')}
						title={counterRunning ? `Timer: ${counter}s remaining (Alt+3)` : 'Timer (Alt+3)'}
						badge={
							counterRunning && counterDuration ? (
								<span className='absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-bold rounded-full min-w-3.5 h-3.5 flex items-center justify-center px-0.5'>
									{formatBadge(counter)}
								</span>
							) : undefined
						}
					>
						<Icon name='clock' size='sm' />
					</IconToggle>
					<IconToggle active={panels.gallery} onClick={() => togglePanel('gallery')} title='Gallery (Alt+4)'>
						<Icon name='gallery' size='sm' />
					</IconToggle>
				</div>

				{/* Zoom controls */}
				{hasImage && (
					<div className='flex items-center gap-1.5 mr-3'>
						<IconButton surface='dark' onClick={zoomOut} title='Zoom Out (Ctrl+-)' className='text-sm px-1'>
							−
						</IconButton>

						<SegmentedControl<ZoomPreset | ''>
							tone='dark'
							options={[
								{ value: 'fit', label: 'Fit', title: 'Fit to View (Ctrl+0)' },
								{ value: '1:1', label: '1:1', title: 'Actual Size (1:1)' },
								{ value: '2x', label: '2×', title: 'Zoom to 200%' },
							]}
							value={
								fitMode === 'fit' ? 'fit' : Math.abs(zoom - 1) < 0.01 ? '1:1' : Math.abs(zoom - 2) < 0.01 ? '2x' : ''
							}
							onChange={(next) => {
								if (next === 'fit') setFitMode('fit');
								else setZoom(next === '1:1' ? 1 : 2);
							}}
						/>

						<span className='text-slate-400 text-[10px] w-8 text-center'>{Math.round(effectiveZoom * 100)}%</span>

						<IconButton surface='dark' onClick={zoomIn} title='Zoom In (Ctrl+=)' className='text-sm px-1'>
							+
						</IconButton>
					</div>
				)}

				<span className={statusStyles[status].className}>{statusStyles[status].text}</span>
			</div>

			<SaveFolderPrompt prompt={savePrompt} />

			{/* Folder Picker Dialog */}
			{pendingOpen && (
				<FolderPickerDialog
					folders={folders}
					onSelect={handleFolderPickerSelect}
					onSkip={handleFolderPickerSkip}
					onCreateFolder={handleCreateFolderInPicker}
				/>
			)}
		</>
	);
};

export default TopPanel;
