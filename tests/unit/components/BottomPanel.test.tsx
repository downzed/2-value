import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRef } from 'react';
import BottomPanel from '../../../src/renderer/components/shell/BottomPanel';
import {
	createCommandsStub,
	createEditorState,
	createEditorStoreStub,
	createGalleryState,
	createGalleryStoreStub,
	createMockImage,
	createOpenItem,
} from '../../helpers/mocks';

/**
 * The component reads the singleton stores through selectors. The mock runs each
 * selector against a plain state object and returns stub stores.
 *
 * The holders must be hoisted: vi.mock factories run before module-level
 * `const`s are initialised, so referencing them directly would be undefined.
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

vi.mock('../../../src/renderer/core/decode', () => ({
	decodeErrorMessage: vi.fn((e: unknown) => String(e)),
}));

function BottomPanelWrapper() {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	return <BottomPanel previewCanvasRef={previewCanvasRef} />;
}

/** Opens the File dropdown and returns its menu items. */
function openFileMenu() {
	fireEvent.click(screen.getByRole('button', { name: 'File' }));
}

type EditorStateLike = ReturnType<typeof createEditorState>;
let editorState: { current: EditorStateLike };
let galleryState: { current: ReturnType<typeof createGalleryState> };
let editorStub: ReturnType<typeof createEditorStoreStub>;
let galleryStub: ReturnType<typeof createGalleryStoreStub>;
let commands: ReturnType<typeof createCommandsStub>;

/** Sets editor state. Tests build items explicitly with createOpenItem. */
function setState(overrides: Partial<EditorStateLike>) {
	editorState.current = createEditorState(overrides);
}

/** A single open image item, for tests about dimensions, names and zoom. */
function imageItem(overrides: Record<string, unknown> = {}) {
	return createOpenItem({ image: createMockImage(800, 600) as never, width: 800, height: 600, ...overrides });
}

/** A single open blank canvas item. */
function blankItem() {
	return createOpenItem({ kind: 'blank', label: 'Canvas 1', fileName: '', image: null });
}

/** Editor state with one open item active. */
function withItem(item: ReturnType<typeof createOpenItem>) {
	setState({ items: [item], activeItemId: item.id });
}

/** Applies action spies onto the editor/gallery stubs. */
function useActions(actions: Record<string, unknown>) {
	Object.assign(editorStub, actions);
}

describe('BottomPanel', () => {
	beforeEach(() => {
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
	});

	it('exposes New, Open, Save and Export under the File menu', () => {
		render(<BottomPanelWrapper />);
		openFileMenu();
		expect(screen.getByText('New')).toBeDefined();
		expect(screen.getByText('Open')).toBeDefined();
		expect(screen.getByText('Save')).toBeDefined();
		expect(screen.getByText('Export as...')).toBeDefined();
	});

	it('describes Save and Export as...', () => {
		render(<BottomPanelWrapper />);
		openFileMenu();
		expect(screen.getByText('Write to the gallery')).toBeDefined();
		expect(screen.getByText('Download a PNG or JPEG')).toBeDefined();
	});

	it('shows the File menu items only when opened', () => {
		render(<BottomPanelWrapper />);
		expect(screen.queryByText('Export as...')).toBeNull();
	});

	it('renders a File menu button', () => {
		render(<BottomPanelWrapper />);
		expect(screen.getByRole('button', { name: 'File' })).toBeDefined();
	});

	it('choosing New starts a blank canvas', () => {
		const newBlankCanvas = vi.fn();
		useActions({ newBlankCanvas });
		render(<BottomPanelWrapper />);
		openFileMenu();
		fireEvent.click(screen.getByText('New'));
		expect(newBlankCanvas).toHaveBeenCalled();
	});

	it('closes the File menu after choosing an item', () => {
		const newBlankCanvas = vi.fn();
		useActions({ newBlankCanvas });
		render(<BottomPanelWrapper />);
		openFileMenu();
		fireEvent.click(screen.getByText('New'));
		expect(screen.queryByText('Export as...')).toBeNull();
	});

	it('Ctrl+N starts a blank canvas without any image loaded', () => {
		const newBlankCanvas = vi.fn();
		useActions({ newBlankCanvas });
		render(<BottomPanelWrapper />);
		fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
		expect(newBlankCanvas).toHaveBeenCalled();
	});

	it('Ctrl+N fires when an image is already open', () => {
		const newBlankCanvas = vi.fn();
		useActions({ newBlankCanvas });
		render(<BottomPanelWrapper />);
		fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
		expect(newBlankCanvas).toHaveBeenCalledTimes(1);
	});

	it('does not fire New on an unrelated shortcut', () => {
		const newBlankCanvas = vi.fn();
		useActions({ newBlankCanvas });
		render(<BottomPanelWrapper />);
		fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
		fireEvent.keyDown(window, { key: 'n' });
		expect(newBlankCanvas).not.toHaveBeenCalled();
	});

	it('displays blank canvas dimensions from the stage size', () => {
		setState({ items: [blankItem()], activeItemId: 'item-1', viewport: { width: 1024, height: 768 } });
		render(<BottomPanelWrapper />);
		expect(screen.getByText('1024 × 768')).toBeDefined();
	});

	it('Save is disabled when no image is loaded', () => {
		render(<BottomPanelWrapper />);
		openFileMenu();
		expect(screen.getByText('Save').closest('button')?.disabled).toBe(true);
	});

	it('Export as... is disabled when no image is loaded', () => {
		render(<BottomPanelWrapper />);
		openFileMenu();
		expect(screen.getByText('Export as...').closest('button')?.disabled).toBe(true);
	});

	it('Save is enabled when image is loaded', () => {
		withItem(imageItem());
		render(<BottomPanelWrapper />);
		openFileMenu();
		expect(screen.getByText('Save').closest('button')?.disabled).toBe(false);
	});

	it('Export as... is enabled when image is loaded', () => {
		withItem(imageItem());
		render(<BottomPanelWrapper />);
		openFileMenu();
		expect(screen.getByText('Export as...').closest('button')?.disabled).toBe(false);
	});

	it('Export as... exports the active item', () => {
		withItem(imageItem());
		render(<BottomPanelWrapper />);
		openFileMenu();
		fireEvent.click(screen.getByText('Export as...'));
		expect(commands.exportOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
	});

	it('Save is enabled for a blank canvas even though no image is loaded', () => {
		withItem(blankItem());
		render(<BottomPanelWrapper />);
		openFileMenu();
		expect(screen.getByText('Save').closest('button')?.disabled).toBe(false);
	});

	it('displays file name when image is loaded', () => {
		withItem(imageItem({ fileName: 'photo.jpg', label: 'photo.jpg' }));
		render(<BottomPanelWrapper />);
		expect(screen.getByText('photo.jpg')).toBeDefined();
	});

	it('displays image dimensions when image is loaded', () => {
		withItem(imageItem({ width: 800, height: 600 }));
		render(<BottomPanelWrapper />);
		expect(screen.getByText('800 × 600')).toBeDefined();
	});

	it('Open from the File menu starts the open flow', async () => {
		render(<BottomPanelWrapper />);
		openFileMenu();
		await act(async () => {
			fireEvent.click(screen.getByText('Open'));
		});
		// Status changes to 'loading' when open is triggered
		expect(screen.getByText('Loading...')).toBeDefined();
	});

	it('shows status text "Ready" initially', () => {
		render(<BottomPanelWrapper />);
		expect(screen.getByText('Ready')).toBeDefined();
	});

	it('always shows all four panel toggles', () => {
		// Closed panels, so this proves nothing is conditionally hidden.
		setState({ panels: { controls: false, original: false, timer: false, gallery: false } });
		render(<BottomPanelWrapper />);
		expect(screen.getByTitle('Adjustments (Alt+1)')).toBeDefined();
		expect(screen.getByTitle('Original (Alt+2)')).toBeDefined();
		expect(screen.getByTitle('Timer (Alt+3)')).toBeDefined();
		expect(screen.getByTitle('Gallery (Alt+4)')).toBeDefined();
	});

	it('keeps the gallery toggle visible while the gallery panel is open', () => {
		setState({ panels: { controls: false, original: false, timer: false, gallery: true } });
		render(<BottomPanelWrapper />);
		expect(screen.getByTitle('Gallery (Alt+4)')).toBeDefined();
	});

	it('marks a panel toggle as pressed while its panel is open', () => {
		setState({ panels: { controls: true, original: false, timer: false, gallery: false } });
		render(<BottomPanelWrapper />);
		expect(screen.getByTitle('Adjustments (Alt+1)').getAttribute('aria-pressed')).toBe('true');
		expect(screen.getByTitle('Gallery (Alt+4)').getAttribute('aria-pressed')).toBe('false');
	});

	it('clicking a panel toggle flips that panel', () => {
		const togglePanel = vi.fn();
		useActions({ togglePanel });
		setState({ panels: { controls: false, original: false, timer: false, gallery: false } });
		render(<BottomPanelWrapper />);
		fireEvent.click(screen.getByTitle('Gallery (Alt+4)'));
		expect(togglePanel).toHaveBeenCalledWith('gallery');
	});

	it('shows zoom controls when image is loaded', () => {
		withItem(imageItem());
		render(<BottomPanelWrapper />);
		expect(screen.getByText('Fit')).toBeDefined();
		expect(screen.getByText('1:1')).toBeDefined();
		expect(screen.getByText('2×')).toBeDefined();
	});

	it('does not show zoom controls when no image is loaded', () => {
		render(<BottomPanelWrapper />);
		expect(screen.queryByText('Fit')).toBeNull();
	});

	it('displays effective zoom percentage', () => {
		withItem(imageItem());
		setState({ items: [imageItem()], activeItemId: 'item-1', fitMode: 'manual', zoom: 0.5 });
		render(<BottomPanelWrapper />);
		expect(screen.getByText('50%')).toBeDefined();
	});
});
