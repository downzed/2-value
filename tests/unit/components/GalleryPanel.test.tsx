import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GalleryPanel from '../../../src/renderer/components/shell/GalleryPanel';
import type { GalleryFolder, GalleryImage } from '../../../src/shared/types';
import type { OpenItem } from '../../../src/renderer/core/types';
import {
	createCommandsStub,
	createEditorState,
	createEditorStoreStub,
	createGalleryState,
	createGalleryStoreStub,
	createOpenItem,
} from '../../helpers/mocks';

/**
 * `GalleryPanel` reads the singleton stores through selectors, so the mock runs
 * each selector against a plain state object and returns stub stores.
 *
 * The holders must be hoisted: vi.mock factories run before module-level `const`s
 * are initialised, so referencing them directly would be undefined.
 */
const holders = vi.hoisted(() => ({
	getEditorState: () => ({}),
	getEditorStore: () => ({}),
	getGalleryState: () => ({}),
	getGalleryStore: () => ({}),
	getCommands: () => ({}),
}));

vi.mock('../../../src/renderer/react/useStore', () => ({
	useEditorStore: () => holders.getEditorStore(),
	useGalleryStore: () => holders.getGalleryStore(),
	useEditorSelector: (selector: (s: never) => unknown) => selector(holders.getEditorState() as never),
	useGallerySelector: (selector: (s: never) => unknown) => selector(holders.getGalleryState() as never),
}));

vi.mock('../../../src/renderer/react/useCommands', () => ({
	useCommands: () => holders.getCommands(),
}));

vi.mock('../../../src/renderer/utils/storage', () => ({
	galleryRepository: { getThumbnailBlob: vi.fn().mockResolvedValue(undefined) },
	getRecents: () => [],
	RECENTS_MAX: 5,
}));

const OPENED_ITEMS_ID = '__opened_items__';

type EditorStateLike = ReturnType<typeof createEditorState>;
type GalleryStateLike = ReturnType<typeof createGalleryState>;

let editorState: { current: EditorStateLike };
let galleryState: { current: GalleryStateLike };
let editorStub: ReturnType<typeof createEditorStoreStub>;
let galleryStub: ReturnType<typeof createGalleryStoreStub>;
let commands: ReturnType<typeof createCommandsStub>;

function folder(id: string, name: string, sortOrder = 0): GalleryFolder {
	return { id, name, tags: [], createdAt: 0, sortOrder };
}

function image(id: string, fileName: string, folderId: string, addedAt = 0): GalleryImage {
	return { id, folderId, fileName, width: 10, height: 10, fileSize: 0, addedAt, source: 'local' };
}

/** The gallery panel only renders at all when its panel flag is on. */
function withPanelOpen() {
	return { panels: { ...editorState.current.panels, gallery: true } };
}

function renderPanel() {
	return render(<GalleryPanel />);
}

describe('GalleryPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		editorState = { current: createEditorState() };
		galleryState = { current: createGalleryState() };
		editorStub = createEditorStoreStub();
		galleryStub = createGalleryStoreStub();
		commands = createCommandsStub();
		holders.getEditorState = () => editorState.current;
		holders.getEditorStore = () => editorStub;
		holders.getGalleryState = () => galleryState.current;
		holders.getGalleryStore = () => galleryStub;
		holders.getCommands = () => commands;
		// Default to open so each test only has to opt out where that is the point.
		editorState.current = createEditorState(withPanelOpen());
		galleryStub.getThumbnailBlob = vi.fn().mockResolvedValue(undefined);
	});

	describe('visibility', () => {
		it('renders nothing when the gallery panel is closed', () => {
			editorState.current = createEditorState({ panels: { ...createEditorState().panels, gallery: false } });
			const { container } = renderPanel();
			expect(container.firstChild).toBeNull();
		});

		it('loads the gallery and clears any error when opened', () => {
			galleryState.current = { ...galleryState.current, error: 'stale error' };
			renderPanel();
			expect(galleryStub.loadGallery).toHaveBeenCalled();
			expect(galleryStub.clearError).toHaveBeenCalled();
		});

		it('closing the panel sets the panel flag false', () => {
			renderPanel();
			fireEvent.click(screen.getByRole('button', { name: 'Close gallery' }));
			expect(editorStub.setPanel).toHaveBeenCalledWith('gallery', false);
		});

		it('surfaces a store error', () => {
			galleryState.current = { ...galleryState.current, error: 'Gallery unavailable' };
			renderPanel();
			expect(screen.getByText('Gallery unavailable')).toBeDefined();
		});
	});

	describe('folder list', () => {
		it('always offers the Opened Items folder, even with no folders stored', () => {
			renderPanel();
			expect(screen.getByRole('button', { name: 'Open Opened Items folder' })).toBeDefined();
		});

		it('shows a loading state while the first load is in flight', () => {
			galleryState.current = { ...galleryState.current, loading: true };
			renderPanel();
			expect(screen.getByText('Loading...')).toBeDefined();
		});

		it('lists folders in sort order, not insertion order', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('b', 'Beta', 1), folder('a', 'Alpha', 0)],
			};
			renderPanel();

			const names = screen.getAllByRole('button', { name: /^Open folder/ }).map((b) => b.textContent);
			expect(names[0]).toContain('Alpha');
			expect(names[1]).toContain('Beta');
		});

		it('counts images per folder', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				images: [image('i1', 'a.png', 'f1'), image('i2', 'b.png', 'f1')],
			};
			renderPanel();
			expect(screen.getByText('2 images')).toBeDefined();
		});

		it('singularises the image count', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				images: [image('i1', 'a.png', 'f1')],
			};
			renderPanel();
			expect(screen.getByText('1 image')).toBeDefined();
		});

		it('opens a folder when its row is clicked', () => {
			galleryState.current = { ...galleryState.current, folders: [folder('f1', 'Refs')] };
			renderPanel();
			fireEvent.click(screen.getByRole('button', { name: 'Open folder Refs' }));
			expect(galleryStub.setSelectedFolder).toHaveBeenCalledWith('f1');
		});
	});

	describe('folder detail', () => {
		it('shows the folder name and its image grid', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				images: [image('i1', 'a.png', 'f1')],
				selectedFolderId: 'f1',
			};
			renderPanel();

			expect(screen.getByText('Refs')).toBeDefined();
			expect(screen.getByLabelText('Open a.png')).toBeDefined();
		});

		it('reports an empty folder instead of rendering an empty grid', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				selectedFolderId: 'f1',
			};
			renderPanel();
			expect(screen.getByText('No images in this folder')).toBeDefined();
		});

		it('goes back to the folder list', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				selectedFolderId: 'f1',
			};
			renderPanel();
			fireEvent.click(screen.getByRole('button', { name: 'Back to folders' }));
			expect(galleryStub.setSelectedFolder).toHaveBeenCalledWith(null);
		});

		it('opens an image and marks it as loading', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				images: [image('i1', 'a.png', 'f1')],
				selectedFolderId: 'f1',
			};
			renderPanel();

			fireEvent.click(screen.getByLabelText('Open a.png'));
			expect(commands.openGalleryImage).toHaveBeenCalledWith('i1');
		});
	});

	describe('search', () => {
		it('filters across every folder, not just the selected one', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs'), folder('f2', 'Drafts')],
				images: [image('i1', 'beach.png', 'f1'), image('i2', 'portrait.png', 'f2')],
				gallerySearchQuery: 'BEACH',
			};
			renderPanel();

			expect(screen.getByLabelText('Open beach.png')).toBeDefined();
			expect(screen.queryByLabelText('Open portrait.png')).toBeNull();
			expect(screen.getByText('1 result')).toBeDefined();
		});

		it('reports when nothing matches', () => {
			galleryState.current = { ...galleryState.current, gallerySearchQuery: 'zzz' };
			renderPanel();
			expect(screen.getByText('No images found')).toBeDefined();
			expect(screen.getByText('0 results')).toBeDefined();
		});

		it('typing a query forwards it to the store', () => {
			renderPanel();
			fireEvent.change(screen.getByPlaceholderText('Search gallery...'), { target: { value: 'sun' } });
			expect(galleryStub.setGallerySearchQuery).toHaveBeenCalledWith('sun');
		});

		it('clearing the search forwards an empty query', () => {
			galleryState.current = { ...galleryState.current, gallerySearchQuery: 'sun' };
			renderPanel();
			fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
			expect(galleryStub.setGallerySearchQuery).toHaveBeenCalledWith('');
		});

		it('a search overrides an open folder selection', () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				selectedFolderId: 'f1',
				gallerySearchQuery: 'zzz',
			};
			renderPanel();
			// The folder header is gone; search results took over.
			expect(screen.queryByRole('button', { name: 'Back to folders' })).toBeNull();
			expect(screen.getByText('No images found')).toBeDefined();
		});
	});

	describe('Opened Items', () => {
		it('counts open editor items', () => {
			editorState.current = createEditorState({
				...withPanelOpen(),
				items: [createOpenItem({ id: 'i1' }), createOpenItem({ id: 'i2' })],
				activeItemId: 'i1',
			});
			renderPanel();
			expect(screen.getAllByText(/2 open items/).length).toBeGreaterThan(0);
		});

		it('opens the virtual folder', () => {
			renderPanel();
			fireEvent.click(screen.getByRole('button', { name: 'Open Opened Items folder' }));
			expect(galleryStub.setSelectedFolder).toHaveBeenCalledWith(OPENED_ITEMS_ID);
		});

		it('says so when nothing is open', () => {
			galleryState.current = { ...galleryState.current, selectedFolderId: OPENED_ITEMS_ID };
			renderPanel();
			expect(screen.getByText('Nothing open')).toBeDefined();
		});

		it('renders a tile per open item and reactivates the clicked one', () => {
			const items: OpenItem[] = [
				createOpenItem({ id: 'i1', label: 'photo.jpg' }),
				createOpenItem({ id: 'i2', label: 'Canvas 1', kind: 'blank', fileName: '' }),
			];
			editorState.current = createEditorState({ ...withPanelOpen(), items, activeItemId: 'i1' });
			galleryState.current = { ...galleryState.current, selectedFolderId: OPENED_ITEMS_ID };
			renderPanel();

			fireEvent.click(screen.getByLabelText('Continue Canvas 1'));
			expect(editorStub.activateItem).toHaveBeenCalledWith('i2');
		});

		it('asks the command for a preview rather than reading strokes itself', async () => {
			const items = [createOpenItem({ id: 'i1', label: 'Canvas 1', kind: 'blank', fileName: '' })];
			editorState.current = createEditorState({ ...withPanelOpen(), items, activeItemId: 'i1' });
			galleryState.current = { ...galleryState.current, selectedFolderId: OPENED_ITEMS_ID };
			renderPanel();

			// Previews load lazily on the row's context menu, not on render.
			fireEvent.contextMenu(screen.getByLabelText('Continue Canvas 1'));

			await waitFor(() => expect(commands.renderItemPreview).toHaveBeenCalledWith(items[0]));
		});
	});

	describe('thumbnails', () => {
		it('reads thumbnail bytes through the store, not the repository directly', async () => {
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				images: [image('i1', 'a.png', 'f1')],
				selectedFolderId: 'f1',
			};
			renderPanel();

			await waitFor(() => expect(galleryStub.getThumbnailBlob).toHaveBeenCalledWith('i1'));
		});

		it('survives a thumbnail read that rejects', async () => {
			galleryStub.getThumbnailBlob = vi.fn().mockRejectedValue(new Error('gone'));
			galleryState.current = {
				...galleryState.current,
				folders: [folder('f1', 'Refs')],
				images: [image('i1', 'a.png', 'f1')],
				selectedFolderId: 'f1',
			};
			renderPanel();

			// The tile still renders; a missing thumbnail falls back to a placeholder.
			await waitFor(() => expect(screen.getByLabelText('Open a.png')).toBeDefined());
		});
	});
});
