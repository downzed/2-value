import { readImg } from 'image-js';
import { useCallback, useEffect, useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';

type Status = 'ready' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error';

interface BottomPanelProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ previewCanvasRef }) => {
	const {
		hasImage,
		currentImage,
		fileName,
		filePath,
		loadImage,
		panels,
		setPanel,
		counter,
		counterRunning,
		counterDuration,
	} = useImageContext();
	const [status, setStatus] = useState<Status>('ready');

	const width = currentImage?.width ?? '--';
	const height = currentImage?.height ?? '--';

	const handleOpen = useCallback(async () => {
		try {
			setStatus('loading');
			const result = await window.electronAPI.openImage();
			if (result?.dataUrl) {
				const img = new window.Image();
				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = () => reject(new Error('Failed to load image element'));
					img.src = result.dataUrl;
				});

				const image = readImg(img);
				const fileName = result.path.split(/[/\\]/).pop() || 'Untitled';

				await loadImage(image, fileName, result.path);
				setStatus('loaded');
			} else {
				setStatus('ready');
			}
		} catch (error) {
			setStatus('error');
			console.error('Failed to open image:', error);
		}
	}, [loadImage]);

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
		<div className='h-8 bg-slate-800 px-4 flex items-center text-xs text-slate-300'>
			{/* File Operations */}
			<button type='button' onClick={handleOpen} className='text-slate-400 hover:text-slate-200 transition-colors mr-4'>
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
						<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<title>controls</title>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
							/>
						</svg>
					</button>
				)}
				{!panels.original && (
					<button
						type='button'
						onClick={() => setPanel('original', true)}
						className='w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200'
						title='Show Original (Alt+2)'
					>
						<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<title>preview</title>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
							/>
						</svg>
					</button>
				)}
				{!panels.timer && (
					<button
						type='button'
						onClick={() => setPanel('timer', true)}
						className='relative w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200'
						title={counterRunning ? `Timer: ${counter}s remaining (Alt+3)` : 'Show Timer (Alt+3)'}
					>
						<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<title>timer</title>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
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
	);
};

export default BottomPanel;
