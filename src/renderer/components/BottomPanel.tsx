import { readImg } from 'image-js';
import { useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';
import { useToast } from '../hooks/useToast';

type Status = 'ready' | 'loading' | 'loaded' | 'saving' | 'saved' | 'error';

interface BottomPanelProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ previewCanvasRef }) => {
	const { hasImage, currentImage, fileName, loadImage } = useImageContext();
	const { showToast } = useToast();
	const [status, setStatus] = useState<Status>('ready');

	const width = currentImage?.width ?? '--';
	const height = currentImage?.height ?? '--';

	const handleOpen = async () => {
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

				await loadImage(image, fileName);
				setStatus('loaded');
				showToast(`Loaded: ${fileName}`, 'success');
			} else {
				setStatus('ready');
			}
		} catch (error) {
			setStatus('error');
			console.error('Failed to open image:', error);
			showToast('Failed to open image', 'error');
		}
	};

	const handleSave = async () => {
		if (!previewCanvasRef.current) return;

		try {
			setStatus('saving');
			const canvas = previewCanvasRef.current;
			const dataUrl = canvas.toDataURL('image/png');

			const savedPath = await window.electronAPI.saveImage(dataUrl);
			if (savedPath) {
				setStatus('saved');
				const savedName = savedPath.split(/[/\\]/).pop() || 'image';
				showToast(`Saved: ${savedName}`, 'success');
				setTimeout(() => setStatus('loaded'), 2000);
			} else {
				setStatus('loaded');
			}
		} catch (error) {
			setStatus('error');
			console.error('Failed to save image:', error);
			showToast('Failed to save image', 'error');
		}
	};

	const statusStyles: Record<Status, { text: string; className: string }> = {
		ready: { text: 'Ready', className: 'text-emerald-400' },
		loading: { text: 'Loading...', className: 'text-yellow-400' },
		loaded: { text: 'Image ready', className: 'text-emerald-400' },
		saving: { text: 'Saving...', className: 'text-yellow-400' },
		saved: { text: 'Saved!', className: 'text-blue-400' },
		error: { text: 'Error', className: 'text-red-400' },
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

			<span className='w-px h-4 bg-slate-600 mr-4'></span>

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

			<span className='flex-1'></span>
			<span className={statusStyles[status].className}>{statusStyles[status].text}</span>
		</div>
	);
};

export default BottomPanel;
