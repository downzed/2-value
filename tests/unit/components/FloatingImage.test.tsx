import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Image as ImageJS } from 'image-js';
import FloatingImage from '../../../src/renderer/components/FloatingImage';
import {
	createEditorState,
	createEditorStoreStub,
	createMockImage,
	createOpenItem,
	setupCanvasMock,
} from '../../helpers/mocks';

/**
 * The component reads the singleton store through selectors. The mock runs each
 * selector against a plain state object and returns a stub store.
 *
 * The holders must be hoisted: vi.mock factories run before module-level
 * `const`s are initialised, so referencing them directly would be undefined.
 */
const holders = vi.hoisted(() => ({
	getEditorState: () => ({}),
	getEditorStore: () => ({}),
}));

vi.mock('../../../src/renderer/react/useStore', () => ({
	useEditorStore: () => holders.getEditorStore(),
	useGalleryStore: () => ({}),
	useEditorSelector: (selector: (s: never) => unknown) => selector(holders.getEditorState() as never),
	useGallerySelector: (selector: (s: never) => unknown) => selector({} as never),
}));

vi.mock('../../../src/renderer/utils/imageConversion', () => ({
	imageToImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
}));

type EditorStateLike = ReturnType<typeof createEditorState>;
let editorState: { current: EditorStateLike };
let editorStub: ReturnType<typeof createEditorStoreStub>;

/** Sets editor state from the legacy flat-field overrides the tests used. */
function setState(overrides: Parameters<typeof translate>[0]) {
	editorState.current = createEditorState(translate(overrides));
}

/** Maps legacy flat fields onto the item-based EditorState shape. */
function translate(overrides: {
	blur?: number;
	threshold?: number;
	values?: 2 | 3;
	showOriginal?: boolean;
	canUndo?: boolean;
	canRedo?: boolean;
	originalImage?: ImageJS | null;
	[key: string]: unknown;
}): Partial<EditorStateLike> {
	const { blur, threshold, values, showOriginal, canUndo, canRedo, originalImage, ...rest } = overrides;
	const needsItem =
		blur !== undefined ||
		threshold !== undefined ||
		values !== undefined ||
		showOriginal !== undefined ||
		canUndo !== undefined ||
		canRedo !== undefined ||
		originalImage !== undefined;
	if (!needsItem) return rest as Partial<EditorStateLike>;
	return {
		...rest,
		items: [createOpenItem({ blur, threshold, values, showOriginal, image: originalImage ?? null })],
		activeItemId: 'item-1',
	} as Partial<EditorStateLike>;
}

/** Applies store-action spies onto the editor stub. */
function useActions(actions: Record<string, unknown>) {
	Object.assign(editorStub, actions);
}

describe('FloatingImage', () => {
	let restoreCanvas: () => void;

	beforeEach(() => {
		restoreCanvas = setupCanvasMock().restore;
		editorState = { current: createEditorState() };
		editorStub = createEditorStoreStub();
		holders.getEditorState = () => editorState.current;
		holders.getEditorStore = () => editorStub;
	});

	afterEach(() => {
		restoreCanvas();
	});

	it('renders nothing when originalImage is null', () => {
		setState({});
		const { container } = render(<FloatingImage />);
		expect(container.firstChild).toBeNull();
	});

	it('renders canvas when originalImage is provided and panel is open', () => {
		const mockImage = createMockImage(50, 50);
		setState({ originalImage: mockImage, panels: { controls: true, original: true, timer: true, gallery: false } });
		render(<FloatingImage />);
		expect(screen.getByRole('toolbar')).toBeDefined();
	});

	it('renders nothing when panel is closed (originalImage present)', () => {
		const mockImage = createMockImage(50, 50);
		setState({ originalImage: mockImage, panels: { controls: true, original: false, timer: true, gallery: false } });
		const { container } = render(<FloatingImage />);
		// FloatingWidget returns null when isOpen=false, but FloatingImage renders it
		// The component itself is still mounted; the panel content is hidden.
		// The toolbar element should not be present.
		expect(container.querySelector('[role="toolbar"]')).toBeNull();
	});

	it('toggle button shows eye-open icon when showOriginal is false', () => {
		const mockImage = createMockImage(50, 50);
		setState({
			originalImage: mockImage,
			showOriginal: false,
			panels: { controls: true, original: true, timer: true, gallery: false },
		});
		render(<FloatingImage />);
		// Button title should say "Show Original" when showOriginal is false
		const btn = screen.getByTitle('Show Original');
		expect(btn).toBeDefined();
	});

	it('toggle button shows eye-closed icon when showOriginal is true', () => {
		const mockImage = createMockImage(50, 50);
		setState({
			originalImage: mockImage,
			showOriginal: true,
			panels: { controls: true, original: true, timer: true, gallery: false },
		});
		render(<FloatingImage />);
		const btn = screen.getByTitle('Show Processed');
		expect(btn).toBeDefined();
	});

	it('clicking toggle calls toggleShowOriginal', () => {
		const toggleShowOriginal = vi.fn();
		const mockImage = createMockImage(50, 50);
		useActions({ toggleShowOriginal });
		setState({
			originalImage: mockImage,
			showOriginal: false,
			panels: { controls: true, original: true, timer: true, gallery: false },
		});
		render(<FloatingImage />);
		fireEvent.click(screen.getByTitle('Show Original'));
		expect(toggleShowOriginal).toHaveBeenCalled();
	});
});
