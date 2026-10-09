import type React from 'react';
import { Button } from '../shared/Button';

interface NewFolderCardProps {
	onClick: () => void;
}

/**
 * Dashed "+ New Folder" tile shown beneath a folder list.
 *
 * Appears in two places — the gallery panel's root view and `FolderPickerDialog`
 * — with identical markup, so both switch to the inline new-folder form on click.
 */
export const NewFolderCard: React.FC<NewFolderCardProps> = ({ onClick }) => (
	<Button
		block
		disabledTone='none'
		onClick={onClick}
		className='rounded-lg border border-dashed border-slate-300 bg-transparent hover:border-slate-400 hover:bg-slate-50 p-3'
	>
		<p className='text-xs font-medium text-slate-400'>+ New Folder</p>
	</Button>
);
