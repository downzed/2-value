import { readImg } from 'image-js';
import { useCallback, useEffect, useState } from 'react';
import { useImageContext } from '../../hooks/ImageContext';
import { Icon } from '../shared/Icon';
import { SectionHeader } from '../shared/SectionHeader';

interface RecentEntry {
	path: string;
	fileName: string;
	thumbnail: string;
	openedAt: number;
}

interface OpenDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onImageLoaded: () => void;
}

const OpenDialog: React.FC<OpenDialogProps> = ({ isOpen, onClose, onImageLoaded }) => {
	const { loadImage } = useImageContext();
	const [recents, setRecents] = useState<RecentEntry[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchRecents = useCallback(async () => {
		try {
			const entries = await window.electronAPI.getRecents();
			setRecents(entries);
		} catch {
			setRecents([]);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			fetchRecents();
			setError(null);
		}
	}, [isOpen, fetchRecents]);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, onClose]);

	const loadFromDataUrl = useCallback(
		async (dataUrl: string, filePath: string) => {
			const img = new window.Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Failed to load image element'));
				img.src = dataUrl;
			});
			const image = readImg(img);
			const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';
			await loadImage(image, fileName, filePath);
		},
		[loadImage],
	);

	const handleRecentClick = useCallback(
		async (entry: RecentEntry) => {
			try {
				setLoading(true);
				setError(null);
				const result = await window.electronAPI.openImageFromPath(entry.path);
				if (!result) {
					await window.electronAPI.removeRecent(entry.path);
					await fetchRecents();
					setError(`"${entry.fileName}" was not found on disk and has been removed.`);
					setLoading(false);
					return;
				}
				await loadFromDataUrl(result.dataUrl, result.path);
				onImageLoaded();
			} catch (err) {
				setError('Failed to open image.');
				console.error('Failed to open recent image:', err);
			} finally {
				setLoading(false);
			}
		},
		[fetchRecents, loadFromDataUrl, onImageLoaded],
	);

	const handleBrowse = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const result = await window.electronAPI.openImage();
			if (result?.dataUrl) {
				await loadFromDataUrl(result.dataUrl, result.path);
				onImageLoaded();
			} else {
				setLoading(false);
			}
		} catch (err) {
			setError('Failed to open image.');
			console.error('Failed to browse image:', err);
			setLoading(false);
		}
	}, [loadFromDataUrl, onImageLoaded]);

	const handleRemoveRecent = useCallback(
		async (e: React.MouseEvent, entryPath: string) => {
			e.stopPropagation();
			await window.electronAPI.removeRecent(entryPath);
			await fetchRecents();
		},
		[fetchRecents],
	);

	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	if (!isOpen) return null;

	return (
		<div
			role='dialog'
			className='fixed inset-0 z-[60] flex items-center justify-center bg-black/50'
			onClick={handleBackdropClick}
		>
			<div className='bg-white rounded-xl shadow-2xl border border-slate-200 w-[480px] max-h-[80vh] flex flex-col'>
				{/* Header */}
				<div className='flex items-center justify-between px-4 py-3 border-b border-slate-100'>
					<span className='text-sm font-semibold text-slate-700'>Open Image</span>
					<button type='button' onClick={onClose} className='text-slate-400 hover:text-slate-600 transition-colors'>
						<Icon name='close' />
					</button>
				</div>

				{/* Body */}
				<div className='p-4 space-y-4 overflow-y-auto'>
					{/* Error message */}
					{error && (
						<div className='text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2'>{error}</div>
					)}

					{/* Recents section */}
					<div className='space-y-2'>
						<SectionHeader>Recents</SectionHeader>
						{recents.length > 0 ? (
							<div className='grid grid-cols-4 gap-3'>
								{recents.map((entry) => (
									<button
										type='button'
										key={entry.path}
										onClick={() => handleRecentClick(entry)}
										disabled={loading}
										className='relative group rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-slate-400 transition-colors disabled:opacity-50 text-left'
									>
										<img src={entry.thumbnail} alt={entry.fileName} className='w-full aspect-square object-cover' />
										<span className='text-[10px] text-slate-500 truncate block px-1 py-0.5'>{entry.fileName}</span>
										<button
											type='button'
											onClick={(e) => handleRemoveRecent(e, entry.path)}
											className='absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] leading-none'
										>
											&times;
										</button>
									</button>
								))}
							</div>
						) : (
							<p className='text-xs text-slate-400 py-4 text-center'>No recent images</p>
						)}
					</div>

					<div className='border-t border-slate-100' />

					{/* Browse button */}
					<button
						type='button'
						onClick={handleBrowse}
						disabled={loading}
						className='w-full px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50'
					>
						Browse Files...
					</button>
				</div>
			</div>
		</div>
	);
};

export default OpenDialog;
