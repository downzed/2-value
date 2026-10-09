import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useDismissable } from '../../react/useDismissable';
import { bySortOrder } from '../../core/selectors';
import Modal from '../shared/Modal';
import type { GalleryFolder } from '../../../shared/types';
import { NewFolderForm } from './NewFolderForm';

interface FolderPickerDialogProps {
	folders: GalleryFolder[];
	onSelect: (folderId: string) => void;
	onSkip: () => void;
	onCreateFolder: (name: string) => Promise<GalleryFolder>;
	/** Label for the dismiss button: "Skip" when importing, "Cancel" when saving. */
	skipLabel?: string;
}

export const FolderPickerDialog: React.FC<FolderPickerDialogProps> = ({
	folders,
	onSelect,
	onSkip,
	onCreateFolder,
	skipLabel = 'Skip',
}) => {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newFolderMode, setNewFolderMode] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	const sorted = useMemo(() => [...folders].sort(bySortOrder), [folders]);

	useDismissable(rootRef, onSkip);

	// Create, then select the new folder. Errors propagate to NewFolderForm,
	// which owns the inline error state.
	const handleCreateFolder = async (name: string) => {
		const folder = await onCreateFolder(name);
		setSelectedId(folder.id);
		setNewFolderMode(false);
	};

	return (
		<Modal widthClass='w-[360px]'>
			<div ref={rootRef}>
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
								<NewFolderForm
									onCreate={handleCreateFolder}
									onCancel={() => setNewFolderMode(false)}
									stopEscapePropagation
								/>
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
							{skipLabel}
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
		</Modal>
	);
};
