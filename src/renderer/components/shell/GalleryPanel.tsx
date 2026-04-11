import { useCallback, useEffect, useState } from 'react';
import { useImageContext } from '../../hooks/ImageContext';
import { imageLoadErrorMessage, useImageLoader } from '../../hooks/useImageLoader';
import type { RecentEntry } from '../../../shared/types';
import { Icon } from '../shared/Icon';
import { SectionHeader } from '../shared/SectionHeader';

const GalleryPanel: React.FC = () => {
	const { panels, setPanel } = useImageContext();
	const { loadFromPath } = useImageLoader();
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
		if (panels.gallery) {
			fetchRecents();
			setError(null);
		}
	}, [panels.gallery, fetchRecents]);

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
				const outcome = await loadFromPath(result.path, result.fileSize);
				if (!outcome.ok) {
					setError(imageLoadErrorMessage(outcome.error));
				}
				await fetchRecents();
			} catch (err) {
				setError('Failed to open image.');
				console.error('Failed to open recent image:', err);
			} finally {
				setLoading(false);
			}
		},
		[fetchRecents, loadFromPath],
	);

	const handleRemoveRecent = useCallback(
		async (e: React.MouseEvent, entryPath: string) => {
			e.stopPropagation();
			await window.electronAPI.removeRecent(entryPath);
			await fetchRecents();
		},
		[fetchRecents],
	);

	if (!panels.gallery) return null;

	return (
		<div className='fixed top-0 right-0 bottom-8 w-[280px] bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col'>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2 border-b border-slate-100'>
				<span className='text-xs font-semibold text-slate-700'>Gallery</span>
				<button
					type='button'
					onClick={() => setPanel('gallery', false)}
					className='text-slate-400 hover:text-slate-600 transition-colors'
				>
					<Icon name='close' />
				</button>
			</div>

			{/* Body — scrollable */}
			<div className='flex-1 overflow-y-auto p-3 space-y-3'>
				{error && <div className='text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2'>{error}</div>}

				<SectionHeader>Recents</SectionHeader>
				{recents.length > 0 ? (
					<div className='grid grid-cols-2 gap-2'>
						{recents.map((entry) => (
							<div
								key={entry.path}
								className='relative group rounded-lg border border-slate-200 overflow-hidden hover:border-slate-400 transition-colors'
							>
								<button
									type='button'
									onClick={() => handleRecentClick(entry)}
									disabled={loading}
									className='w-full cursor-pointer disabled:opacity-50 text-left'
								>
									<img src={entry.thumbnail} alt={entry.fileName} className='w-full aspect-square object-cover' />
									<span className='text-[10px] text-slate-500 truncate block px-1 py-0.5'>{entry.fileName}</span>
								</button>
								<button
									type='button'
									onClick={(e) => handleRemoveRecent(e, entry.path)}
									disabled={loading}
									className='absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] leading-none disabled:opacity-50'
								>
									&times;
								</button>
							</div>
						))}
					</div>
				) : (
					<p className='text-xs text-slate-400 py-4 text-center'>No recent images</p>
				)}
			</div>
		</div>
	);
};

export default GalleryPanel;
