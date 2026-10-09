import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSaveFlow } from '../../../src/renderer/react/useSaveFlow';
import { SaveFolderPrompt } from '../../../src/renderer/components/gallery/SaveFolderPrompt';

const holders = vi.hoisted(() => ({
	getGalleryStore: () => ({}),
	getFolders: () => [] as { id: string; name: string }[],
}));

vi.mock('../../../src/renderer/react/useStore', () => ({
	useGalleryStore: () => holders.getGalleryStore(),
	useEditorStore: () => ({}),
	useEditorSelector: () => undefined,
	useGallerySelector: () => holders.getFolders(),
}));

vi.mock('../../../src/renderer/react/useCommands', () => ({
	useCommands: () => commandsStub,
}));

const commandsStub = { saveActiveItemToGallery: vi.fn().mockResolvedValue(undefined) };

const REF_FOLDER = { id: 'f1', name: 'Refs' };

/** Renders the trigger and the dialog in one tree, the way real callers do. */
function Wrapper({ hasEntry }: { hasEntry: boolean }) {
	const { requestSave, prompt } = useSaveFlow();
	return (
		<div>
			<button
				type='button'
				onClick={() =>
					requestSave((folderId) => commandsStub.saveActiveItemToGallery(new Blob(['x']), 'a.png', folderId), hasEntry)
				}
			>
				Trigger save
			</button>
			<SaveFolderPrompt prompt={prompt} />
		</div>
	);
}

describe('useSaveFlow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		holders.getFolders = () => [];
		holders.getGalleryStore = () => ({ createFolder: vi.fn(), loadGallery: vi.fn() });
	});

	it('saves immediately when the item already has a gallery entry', () => {
		render(<Wrapper hasEntry />);
		fireEvent.click(screen.getByText('Trigger save'));

		expect(commandsStub.saveActiveItemToGallery).toHaveBeenCalledWith(expect.anything(), 'a.png', null);
	});

	it('does not prompt when the item already has a gallery entry', () => {
		render(<Wrapper hasEntry />);
		fireEvent.click(screen.getByText('Trigger save'));

		expect(screen.queryByText('Save to folder')).toBeNull();
	});

	it('asks for a folder when the item has no gallery entry', () => {
		holders.getFolders = () => [REF_FOLDER];
		render(<Wrapper hasEntry={false} />);
		fireEvent.click(screen.getByText('Trigger save'));

		expect(commandsStub.saveActiveItemToGallery).not.toHaveBeenCalled();
		expect(screen.getByText('Save to folder')).toBeDefined();
		expect(screen.getByText('Refs')).toBeDefined();
	});

	it('saves into the chosen folder', () => {
		holders.getFolders = () => [REF_FOLDER];
		render(<Wrapper hasEntry={false} />);
		fireEvent.click(screen.getByText('Trigger save'));

		fireEvent.click(screen.getByText('Refs'));
		// The confirm button is the one inside the dialog's footer.
		fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(commandsStub.saveActiveItemToGallery).toHaveBeenCalledWith(expect.anything(), 'a.png', 'f1');
	});

	it('does not save when the prompt is cancelled', () => {
		holders.getFolders = () => [REF_FOLDER];
		render(<Wrapper hasEntry={false} />);
		fireEvent.click(screen.getByText('Trigger save'));

		fireEvent.click(screen.getByText('Cancel'));

		expect(commandsStub.saveActiveItemToGallery).not.toHaveBeenCalled();
		expect(screen.queryByText('Save to folder')).toBeNull();
	});

	it('labels the dismiss action Cancel when saving', () => {
		holders.getFolders = () => [REF_FOLDER];
		render(<Wrapper hasEntry={false} />);
		fireEvent.click(screen.getByText('Trigger save'));

		expect(screen.getByText('Cancel')).toBeDefined();
		expect(screen.queryByText('Skip')).toBeNull();
	});
});
