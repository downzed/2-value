import { useCallback, useEffect, useState } from 'react';
import { useImageContext } from '../../hooks/ImageContext';
import { useGalleryContext } from '../../hooks/GalleryContext';
import { imageLoadErrorMessage, useImageLoader } from '../../hooks/useImageLoader';
import { Icon } from '../shared/Icon';
import { FolderPickerDialog } from '../gallery/FolderPickerDialog';

type Status = 'ready' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error';

interface PendingOpen {
	path: string;
	fileName: string;
	fileSize: number;
}

interface BottomPanelProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ previewCanvasRef }) => {
	const {
		hasImage,
		currentImage,
		fileName,
		filePath,
		panels,
		setPanel,
		counter,
		counterRunning,
		counterDuration,
		zoom,
		fitMode,
		effectiveZoom,
		setFitMode,
		setZoom,
		zoomIn,
		zoomOut,
	} = useImageContext();
	const { folders, importImage, loadGallery } = useGalleryContext();
	const { loadFromPath } = useImageLoader();
	const [status, setStatus] = useState<Status>('ready');
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);

	const width = currentImage?.width ?? '--';
	const height = currentImage?.height ?? '--';

	// Load an image from path (shared by both skip and save flows)
	const doLoadFromPath = useCallback(
		async (result: PendingOpen) => {
			const outcome = await loadFromPath(result.path, result.fileSize);
			if (outcome.ok) {
				setStatus('loaded');
			} else {
				const msg = imageLoadErrorMessage(outcome.error);
				setErrorMsg(msg);
				setStatus('error');
				console.error('Image load rejected:', outcome.error);
			}
		},
		[loadFromPath],
	);

	const handleOpen = useCallback(async () => {
		try {
			setStatus('loading');
			setErrorMsg(null);
			const result = await window.electronAPI.openImage();
			if (result) {
				// Show folder picker dialog instead of loading immediately
				setPendingOpen(result);
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
			const result = pendingOpen;
			setPendingOpen(null);

			try {
				await importImage(result.path, folderId);
			} catch (err) {
				// Duplicate rejection: show message but still open the image
				const msg = err instanceof Error ? err.message : 'Import failed';
				if (msg.includes('already in')) {
					console.warn('Duplicate detected, opening image anyway:', msg);
				} else {
					console.error('Import failed:', err);
				}
			}

			await doLoadFromPath(result);
		},
		[pendingOpen, importImage, doLoadFromPath],
	);

	const handleFolderPickerSkip = useCallback(async () => {
		if (!pendingOpen) return;
		const result = pendingOpen;
		setPendingOpen(null);
		await doLoadFromPath(result);
	}, [pendingOpen, doLoadFromPath]);

	const handleCreateFolderInPicker = useCallback(
		async (name: string) => {
			const folder = await window.electronAPI.galleryCreateFolder(name);
			await loadGallery();
			return folder;
		},
		[loadGallery],
	);

	const handleSave = useCallback(async () => {
		if (!previewCanvasRef.current) return;

		try {
			setStatus('saving');
			const canvas = previewCanvasRef.current;
			// Use binary transport: canvas.toBlob -> ArrayBuffer -> IPC (avoids base64 inflation)
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
			});
			const buffer = await blob.arrayBuffer();
			const savedPath = await window.electronAPI.saveImage(buffer, filePath || undefined);
			if (savedPath) {
				setStatus('saved');
				setTimeout(() => setStatus('loaded'), 2000);
			} else {
				setStatus('loaded');
			}
		} catch (error) {
			setStatus('error');
			console.error('Failed to save image:', error);
		}
	}, [previewCanvasRef, filePath]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
				e.preventDefault();
				handleOpen();
			} else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				if (hasImage) handleSave();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [hasImage, handleOpen, handleSave]);

	const statusStyles: Record<Status, { text: string; className: string }> = {
		ready: { text: 'Ready', className: 'text-emerald-400' },
		loading: { text: 'Loading...', className: 'text-yellow-400' },
		loaded: { text: 'Image ready', className: 'text-emerald-400' },
		saving: { text: 'Saving...', className: 'text-yellow-400' },
		saved: { text: 'Saved!', className: 'text-blue-400' },
		error: { text: errorMsg ?? 'Error', className: 'text-red-400' },
	};

	const formatBadge = (seconds: number): string => {
		if (seconds < 60) return `${seconds}`;
		return `${Math.floor(seconds / 60)}m`;
	};

	return (
		<>
			<div className='h-8 bg-slate-800 px-4 flex items-center text-xs text-slate-300'>
				{/* File Operations */}
				<button
					type='button'
					onClick={handleOpen}
					className='text-slate-400 hover:text-slate-200 transition-colors mr-4'
				>
					Open
				</button>

				<button
					type='button'
					onClick={handleSave}
					disabled={!hasImage}
					className='text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mr-4'
				>
					Save
				</button>

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

				{/* Minimized panel icons */}
				<div className='flex items-center gap-1 mr-3'>
					{!panels.controls && (
						<button
							type='button'
							onClick={() => setPanel('controls', true)}
							className='w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200'
							title='Show Adjustments (Alt+1)'
						>
							<Icon name='sliders' size='sm' />
						</button>
					)}
					{!panels.original && (
						<button
							type='button'
							onClick={() => setPanel('original', true)}
							className='w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200'
							title='Show Original (Alt+2)'
						>
							<Icon name='image' size='sm' />
						</button>
					)}
					{!panels.timer && (
						<button
							type='button'
							onClick={() => setPanel('timer', true)}
							className='relative w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200'
							title={counterRunning ? `Timer: ${counter}s remaining (Alt+3)` : 'Show Timer (Alt+3)'}
						>
							<Icon name='clock' size='sm' />
							{counterRunning && counterDuration && (
								<span className='absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5'>
									{formatBadge(counter)}
								</span>
							)}
						</button>
					)}
					{!panels.gallery && (
						<button
							type='button'
							onClick={() => setPanel('gallery', true)}
							className='w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200'
							title='Show Gallery (Alt+4)'
						>
							<Icon name='gallery' size='sm' />
						</button>
					)}
				</div>

				{/* Zoom controls */}
				{hasImage && (
					<div className='flex items-center gap-1.5 mr-3'>
						<button
							type='button'
							onClick={zoomOut}
							className='text-slate-400 hover:text-slate-200 transition-colors text-sm px-1'
							title='Zoom Out (Ctrl+-)'
						>
							−
						</button>

						<div className='flex items-center bg-slate-700/50 rounded p-0.5'>
							<button
								type='button'
								onClick={() => setFitMode('fit')}
								className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
									fitMode === 'fit' ? 'bg-slate-500 text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-200'
								}`}
								title='Fit to View (Ctrl+0)'
							>
								Fit
							</button>
							<button
								type='button'
								onClick={() => setZoom(1)}
								className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
									fitMode === 'manual' && Math.abs(zoom - 1) < 0.01
										? 'bg-slate-500 text-slate-100 shadow-sm'
										: 'text-slate-400 hover:text-slate-200'
								}`}
								title='Actual Size (1:1)'
							>
								1:1
							</button>
							<button
								type='button'
								onClick={() => setZoom(2)}
								className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
									fitMode === 'manual' && Math.abs(zoom - 2) < 0.01
										? 'bg-slate-500 text-slate-100 shadow-sm'
										: 'text-slate-400 hover:text-slate-200'
								}`}
								title='Double Size (2×)'
							>
								2×
							</button>
						</div>

						<span className='text-slate-400 text-[10px] w-8 text-center'>{Math.round(effectiveZoom * 100)}%</span>

						<button
							type='button'
							onClick={zoomIn}
							className='text-slate-400 hover:text-slate-200 transition-colors text-sm px-1'
							title='Zoom In (Ctrl+=)'
						>
							+
						</button>
					</div>
				)}

				<span className={statusStyles[status].className}>{statusStyles[status].text}</span>
			</div>

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

export default BottomPanel;
