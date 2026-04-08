import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GalleryFolder } from '../../../shared/types';

interface FolderPickerDialogProps {
	folders: GalleryFolder[];
	onSelect: (folderId: string) => void;
	onSkip: () => void;
	onCreateFolder: (name: string) => Promise<GalleryFolder>;
}

export const FolderPickerDialog: React.FC<FolderPickerDialogProps> = ({
	folders,
	onSelect,
	onSkip,
	onCreateFolder,
}) => {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newFolderMode, setNewFolderMode] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const [newFolderError, setNewFolderError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const newFolderInputRef = useRef<HTMLInputElement>(null);

	const sorted = useMemo(() => [...folders].sort((a, b) => a.sortOrder - b.sortOrder), [folders]);

	useEffect(() => {
		if (newFolderMode) {
			newFolderInputRef.current?.focus();
		}
	}, [newFolderMode]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onSkip();
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [onSkip]);

	const handleCreateFolder = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = newFolderName.trim();
		if (!name) return;
		try {
			setCreating(true);
			setNewFolderError(null);
			const folder = await onCreateFolder(name);
			setSelectedId(folder.id);
			setNewFolderName('');
			setNewFolderMode(false);
		} catch (err) {
			setNewFolderError(err instanceof Error ? err.message : 'Failed to create folder.');
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className='fixed inset-0 z-[300] flex items-center justify-center bg-black/40'>
			<div className='bg-white rounded-xl shadow-2xl p-5 w-[360px] space-y-4'>
				<h2 className='text-sm font-semibold text-slate-800'>Save to folder</h2>

				<ul className='grid grid-cols-2 gap-2 list-none p-0 m-0 max-h-[240px] overflow-y-auto'>
					{sorted.map((folder) => (
						<li key={folder.id}>
							<button
								type='button'
								onClick={() => setSelectedId(folder.id)}
								className={`w-full rounded-lg border p-3 text-left transition-colors ${
									selectedId === folder.id
										? 'border-slate-800 bg-slate-100'
										: 'border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
								}`}
							>
								<p className='text-xs font-medium text-slate-700 truncate'>{folder.name}</p>
							</button>
						</li>
					))}

					{/* New Folder card */}
					{newFolderMode ? (
						<li>
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
									disabled={creating}
									className='text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-slate-500 w-full'
									onKeyDown={(e) => {
										if (e.key === 'Escape') {
											e.stopPropagation();
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
										disabled={creating}
										className='flex-1 text-[10px] bg-slate-800 text-white rounded py-1 hover:bg-slate-700 transition-colors disabled:opacity-50'
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
						</li>
					) : (
						<li>
							<button
								type='button'
								onClick={() => setNewFolderMode(true)}
								className='w-full rounded-lg border border-dashed border-slate-300 bg-transparent hover:border-slate-400 hover:bg-slate-50 transition-colors p-3 text-left'
							>
								<p className='text-xs font-medium text-slate-400'>+ New Folder</p>
							</button>
						</li>
					)}
				</ul>

				<div className='flex justify-end gap-2'>
					<button
						type='button'
						onClick={onSkip}
						className='px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors'
					>
						Skip
					</button>
					<button
						type='button'
						onClick={() => selectedId && onSelect(selectedId)}
						disabled={!selectedId}
						className='px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
};
