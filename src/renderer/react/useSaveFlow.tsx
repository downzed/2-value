import { useCallback, useState } from 'react';
import { FolderPickerDialog } from '../components/gallery/FolderPickerDialog';
import { useGallerySelector, useGalleryStore } from './useStore';

/**
 * Saving into the gallery, with a folder prompt when one is needed.
 *
 * There is no implicit destination folder, so an item that is not already
 * gallery-backed has to be told where it goes. Shared by the status bar and the
 * gallery's opened-items menu so both behave identically.
 */
export function useSaveFlow() {
	const gallery = useGalleryStore();
	const folders = useGallerySelector((s) => s.folders);

	/** The save to run once a folder has been chosen. */
	const [pending, setPending] = useState<((folderId: string) => Promise<void>) | null>(null);

	const createFolder = useCallback(
		async (name: string) => {
			const folder = await gallery.createFolder(name);
			await gallery.loadGallery();
			return folder;
		},
		[gallery],
	);

	/**
	 * Runs `save` immediately when the destination is already known, otherwise
	 * shows the picker and runs it with the chosen folder.
	 *
	 * `hasEntry` is true when the item already has a gallery entry to overwrite,
	 * in which case no folder is needed.
	 */
	const requestSave = useCallback((save: (folderId: string | null) => Promise<void>, hasEntry: boolean) => {
		if (hasEntry) {
			void save(null);
			return;
		}
		setPending(() => async (folderId: string) => {
			await save(folderId);
		});
	}, []);

	const cancel = useCallback(() => setPending(null), []);

	const dialog = pending ? (
		<FolderPickerDialog
			folders={folders}
			skipLabel='Cancel'
			onSelect={(folderId) => {
				const run = pending;
				setPending(null);
				void run(folderId);
			}}
			onSkip={cancel}
			onCreateFolder={createFolder}
		/>
	) : null;

	return { requestSave, cancel, dialog };
}
