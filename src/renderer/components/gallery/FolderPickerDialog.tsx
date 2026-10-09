import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useDismissable } from '../../react/useDismissable';
import { bySortOrder } from '../../core/selectors';
import Modal from '../shared/Modal';
import { DialogButton } from '../shared/DialogButton';
import { Button } from '../shared/Button';
import type { GalleryFolder } from '../../../shared/types';
import { NewFolderCard } from './NewFolderCard';
import { NewFolderForm } from './NewFolderForm';

export interface FolderPickerDialogProps {
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
								<Button
									block
									label={`Select folder ${folder.name}`}
									pressed={selectedId === folder.id}
									disabledTone='none'
									onClick={() => setSelectedId(folder.id)}
									className={`rounded-lg border p-3 ${
										selectedId === folder.id
											? 'border-slate-800 bg-slate-100'
											: 'border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
									}`}
								>
									<p className='text-xs font-medium text-slate-700 truncate'>{folder.name}</p>
								</Button>
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
								<NewFolderCard onClick={() => setNewFolderMode(true)} />
							</li>
						)}
					</ul>

					<div className='flex justify-end gap-2'>
						<DialogButton variant='ghost' onClick={onSkip}>
							{skipLabel}
						</DialogButton>
						<DialogButton disabled={!selectedId} onClick={() => selectedId && onSelect(selectedId)}>
							Save
						</DialogButton>
					</div>
				</div>
			</div>
		</Modal>
	);
};
