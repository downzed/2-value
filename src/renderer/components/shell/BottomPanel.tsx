import { useCallback, useEffect, useState } from 'react';
import { useImageContext } from '../../hooks/ImageContext';
import { Icon } from '../shared/Icon';
import OpenDialog from './OpenDialog';

type Status = 'ready' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error';

interface BottomPanelProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ previewCanvasRef }) => {
	const { hasImage, currentImage, fileName, filePath, panels, setPanel, counter, counterRunning, counterDuration } =
		useImageContext();
	const [status, setStatus] = useState<Status>('ready');
	const [openDialogVisible, setOpenDialogVisible] = useState(false);

	const width = currentImage?.width ?? '--';
	const height = currentImage?.height ?? '--';

	const handleOpen = useCallback(() => {
		setOpenDialogVisible(true);
	}, []);

	const handleImageLoaded = useCallback(() => {
		setOpenDialogVisible(false);
		setStatus('loaded');
	}, []);

	const handleSave = useCallback(async () => {
		if (!previewCanvasRef.current) return;

		try {
			setStatus('saving');
			const canvas = previewCanvasRef.current;
			const dataUrl = canvas.toDataURL('image/png');

			const savedPath = await window.electronAPI.saveImage(dataUrl, filePath || undefined);
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
		error: { text: 'Error', className: 'text-red-400' },
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
				</div>

				<span className={statusStyles[status].className}>{statusStyles[status].text}</span>
			</div>

			<OpenDialog
				isOpen={openDialogVisible}
				onClose={() => setOpenDialogVisible(false)}
				onImageLoaded={handleImageLoaded}
			/>
		</>
	);
};

export default BottomPanel;
