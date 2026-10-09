import type React from 'react';

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
	<button
		type='button'
		onClick={onClick}
		className='w-full rounded-lg border border-dashed border-slate-300 bg-transparent hover:border-slate-400 hover:bg-slate-50 transition-colors p-3 text-left'
	>
		<p className='text-xs font-medium text-slate-400'>+ New Folder</p>
	</button>
);
