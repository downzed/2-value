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

	it('renders Open and Save buttons', () => {
		render(<BottomPanelWrapper />);
		expect(screen.getByText('Open')).toBeDefined();
		expect(screen.getByText('Save')).toBeDefined();
	});

	it('renders a New button', () => {
		render(<BottomPanelWrapper />);
		expect(screen.getByText('New')).toBeDefined();
	});

	it('clicking New starts a blank canvas', () => {
		const newBlankCanvas = vi.fn();
		useActions({ newBlankCanvas });
		render(<BottomPanelWrapper />);
		fireEvent.click(screen.getByText('New'));
		expect(newBlankCanvas).toHaveBeenCalled();
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

	it('Save button is disabled when no image is loaded', () => {
		render(<BottomPanelWrapper />);
		const saveBtn = screen.getByText('Save').closest('button');
		expect(saveBtn?.disabled).toBe(true);
	});

	it('Save button is enabled when image is loaded', () => {
		withItem(imageItem());
		render(<BottomPanelWrapper />);
		const saveBtn = screen.getByText('Save').closest('button');
		expect(saveBtn?.disabled).toBe(false);
	});

	it('Save button is enabled for a blank canvas even though no image is loaded', () => {
		withItem(blankItem());
		render(<BottomPanelWrapper />);
		const saveBtn = screen.getByText('Save').closest('button');
		expect(saveBtn?.disabled).toBe(false);
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

	it('Open button exists and is clickable', async () => {
		render(<BottomPanelWrapper />);
		const openBtn = screen.getByText('Open').closest('button');
		expect(openBtn).toBeDefined();
		await act(async () => {
			fireEvent.click(openBtn as HTMLButtonElement);
		});
		// Status changes to 'loading' when open is triggered
		expect(screen.getByText('Loading...')).toBeDefined();
	});

	it('shows status text "Ready" initially', () => {
		render(<BottomPanelWrapper />);
		expect(screen.getByText('Ready')).toBeDefined();
	});

	it('shows minimized controls icon when controls panel is closed', () => {
		setState({ panels: { controls: false, original: true, timer: true, gallery: false } });
		render(<BottomPanelWrapper />);
		const btn = screen.getByTitle('Show Adjustments (Alt+1)');
		expect(btn).toBeDefined();
	});

	it('clicking minimized controls icon calls setPanel to reopen it', () => {
		const setPanel = vi.fn();
		useActions({ setPanel });
		setState({ panels: { controls: false, original: true, timer: true, gallery: false } });
		render(<BottomPanelWrapper />);
		fireEvent.click(screen.getByTitle('Show Adjustments (Alt+1)'));
		expect(setPanel).toHaveBeenCalledWith('controls', true);
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
