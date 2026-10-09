import type React from 'react';
import { FolderPickerDialog, type FolderPickerDialogProps } from './FolderPickerDialog';

interface SaveFolderPromptProps {
	/** Props from `useSaveFlow`, or null while nothing is pending. */
	prompt: FolderPickerDialogProps | null;
}

/**
 * Renders the save flow's folder prompt.
 *
 * Exists so `react/useSaveFlow.ts` can stay free of a `components/` dependency:
 * the hook returns props, this renders them.
 */
export const SaveFolderPrompt: React.FC<SaveFolderPromptProps> = ({ prompt }) =>
	prompt ? <FolderPickerDialog {...prompt} /> : null;
