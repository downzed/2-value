import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Canvas from '../../../src/renderer/components/Canvas';
import {
	createEditorState,
	createEditorStoreStub,
	createMockImage,
	createOpenItem,
	setupCanvasMock,
	setupPointerCaptureMock,
	setupResizeObserverMock,
	stubBoundingRect,
} from '../../helpers/mocks';
import { useRef } from 'react';

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
	getGalleryState: () => ({}),
	getGalleryStore: () => ({}),
}));

vi.mock('../../../src/renderer/react/useStore', () => ({
	useEditorStore: () => holders.getEditorStore(),
	useGalleryStore: () => holders.getGalleryStore(),
	useEditorSelector: (selector: (s: never) => unknown) => selector(holders.getEditorState() as never),
	useGallerySelector: (selector: (s: never) => unknown) => selector(holders.getGalleryState() as never),
}));

// Hoisted so assertions can reach the worker entry point across the mock boundary.
const { workerMock } = vi.hoisted(() => ({ workerMock: vi.fn(() => () => {}) }));

vi.mock('../../../src/renderer/hooks/useImageProcessingWorker', () => ({
	useImageProcessingWorker: vi.fn(() => ({
		process: workerMock,
	})),
}));

vi.mock('../../../src/renderer/utils/imageConversion', () => ({
	imageToImageData: vi.fn(() => ({
		data: new Uint8ClampedArray(4 * 100 * 100),
		width: 100,
		height: 100,
	})),
}));

type EditorStateLike = ReturnType<typeof createEditorState>;
let editorState: { current: EditorStateLike };
let galleryState: { current: { folders: unknown[]; images: unknown[] } };
let editorStub: ReturnType<typeof createEditorStoreStub>;

/** Shorthand for the common cases: no item open, a blank canvas, or an image. */
function openImage(width = 100, height = 100) {
	editorState.current = createEditorState({
		items: [createOpenItem({ image: createMockImage(width, height) })],
		activeItemId: 'item-1',
	});
}

function openBlank(id = 'blank-1') {
	editorState.current = createEditorState({
		items: [createOpenItem({ id, kind: 'blank', label: 'Canvas 1', fileName: '', image: null })],
		activeItemId: id,
	});
}

// Wrapper to provide a previewCanvasRef
function CanvasWrapper() {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	return <Canvas previewCanvasRef={previewCanvasRef} />;
}

describe('Canvas', () => {
	let restoreResizeObserver: () => void;
	let restoreCanvas: () => void;
	let restorePointerCapture: () => void;
	let ctx: ReturnType<typeof setupCanvasMock>['ctx'];
	let emitSize: ReturnType<typeof setupResizeObserverMock>['emitSize'];

	beforeEach(() => {
		const resizeMock = setupResizeObserverMock();
		restoreResizeObserver = resizeMock.restore;
		emitSize = resizeMock.emitSize;
		const canvasMock = setupCanvasMock();
		ctx = canvasMock.ctx;
		restoreCanvas = canvasMock.restore;
		restorePointerCapture = setupPointerCaptureMock().restore;
		editorState = { current: createEditorState() };
		galleryState = { current: { folders: [], images: [] } };
		editorStub = createEditorStoreStub();
		holders.getEditorState = () => editorState.current;
		holders.getEditorStore = () => editorStub;
		holders.getGalleryState = () => galleryState.current;
		holders.getGalleryStore = () => ({});
	});

	afterEach(() => {
		restoreResizeObserver();
		restoreCanvas();
		restorePointerCapture();
		vi.clearAllMocks();
	});

	it('renders empty state with placeholder when no image is loaded', () => {
		render(<CanvasWrapper />);
		expect(screen.getByText('No image loaded')).toBeDefined();
		expect(screen.getByText('Click "New" or "Open" to get started')).toBeDefined();
	});

	it('does not render the "No image loaded" placeholder when image is provided', () => {
		openImage();
		render(<CanvasWrapper />);
		expect(screen.queryByText('No image loaded')).toBeNull();
	});

	it('renders a canvas element when image is provided', () => {
		openImage();
		const { container } = render(<CanvasWrapper />);
		const canvas = container.querySelector('canvas');
		expect(canvas).not.toBeNull();
	});

	describe('blank canvas', () => {
		it('renders a canvas and not the empty state', () => {
			openBlank();
			const { container } = render(<CanvasWrapper />);
			expect(container.querySelector('canvas')).not.toBeNull();
			expect(screen.queryByText('No image loaded')).toBeNull();
		});

		it('sizes the backing store to the stage with the MIN_SIZE floor', () => {
			openBlank();
			const { container } = render(<CanvasWrapper />);
			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			// containerSize is 0 in jsdom, so the MIN_SIZE floor applies.
			expect(canvas.width).toBe(320);
			expect(canvas.height).toBe(320);
		});

		it('fills the surface with the background colour on mount', () => {
			openBlank();
			render(<CanvasWrapper />);
			expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 320, 320);
		});

		it('reports the measured stage size to context', () => {
			const setViewport = vi.fn();
			Object.assign(editorStub, { setViewport });
			openBlank();
			render(<CanvasWrapper />);
			expect(setViewport).toHaveBeenCalledWith({ width: 0, height: 0 });
		});

		it('never invokes the filter worker', () => {
			openBlank();
			render(<CanvasWrapper />);
			expect(workerMock).not.toHaveBeenCalled();
			expect(ctx.putImageData).not.toHaveBeenCalled();
		});

		it('draws a stroke segment while dragging', () => {
			openBlank();
			const { container } = render(<CanvasWrapper />);
			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			stubBoundingRect(canvas, { width: 320, height: 320, left: 0, top: 0 });

			fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
			fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 160, clientY: 160 });

			expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
			expect(ctx.lineTo).toHaveBeenCalledWith(160, 160);
			expect(ctx.stroke).toHaveBeenCalled();
			expect(ctx.lineWidth).toBe(6);
		});

		it('paints a dot when the pointer is tapped without dragging', () => {
			openBlank();
			const { container } = render(<CanvasWrapper />);
			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			stubBoundingRect(canvas, { width: 320, height: 320, left: 0, top: 0 });

			fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 64, clientY: 64 });
			fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 64, clientY: 64 });

			expect(ctx.arc).toHaveBeenCalledWith(64, 64, 3, 0, Math.PI * 2);
			expect(ctx.fill).toHaveBeenCalled();
		});

		it('ignores non-primary buttons', () => {
			openBlank();
			const { container } = render(<CanvasWrapper />);
			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			stubBoundingRect(canvas, { width: 320, height: 320, left: 0, top: 0 });

			fireEvent.pointerDown(canvas, { button: 2, pointerId: 1, clientX: 10, clientY: 10 });
			fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 100, clientY: 100 });

			expect(ctx.stroke).not.toHaveBeenCalled();
		});

		it('starts a distinct canvas with no strokes for each new item', () => {
			const renderBlank = (id: string) => openBlank(id);

			renderBlank('blank-1');
			const { container, rerender } = render(<CanvasWrapper />);
			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			stubBoundingRect(canvas, { width: 320, height: 320, left: 0, top: 0 });

			fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
			fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 320, clientY: 320 });
			fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 320, clientY: 320 });
			expect(ctx.stroke).toHaveBeenCalled();

			vi.clearAllMocks();

			// Pressing "New" again activates a different item id: that item has no
			// strokes, so the surface is refilled and nothing is replayed.
			renderBlank('blank-2');
			rerender(<CanvasWrapper />);

			expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 320, 320);
			expect(ctx.stroke).not.toHaveBeenCalled();
		});

		it('restores each canvas drawing when switching items', () => {
			// Both items share the stub's stroke map, as the real store does.
			const show = (id: string) => openBlank(id);

			show('canvas-a');
			const { container, rerender } = render(<CanvasWrapper />);
			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			stubBoundingRect(canvas, { width: 320, height: 320, left: 0, top: 0 });

			// Draw on canvas A.
			fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
			fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
			fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 100, clientY: 100 });

			// Switch to canvas B: it has no strokes, so nothing is replayed.
			show('canvas-b');
			rerender(<CanvasWrapper />);
			vi.clearAllMocks();
			rerender(<CanvasWrapper />);
			expect(ctx.stroke).not.toHaveBeenCalled();

			// Switch back to A: its stroke is replayed from the shared store.
			show('canvas-a');
			rerender(<CanvasWrapper />);
			expect(ctx.stroke).toHaveBeenCalled();
			expect(ctx.lineTo).toHaveBeenCalledWith(100, 100);
		});

		it('rescales and replays strokes when the stage is resized', () => {
			openBlank();
			const { container } = render(<CanvasWrapper />);
			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			stubBoundingRect(canvas, { width: 320, height: 320, left: 0, top: 0 });

			fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
			fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 320, clientY: 320 });
			fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 320, clientY: 320 });

			vi.clearAllMocks();
			// Strokes are normalized, so a resize must rescale them, not drop them.
			act(() => {
				emitSize(640, 480);
			});

			expect(canvas.width).toBe(640);
			expect(canvas.height).toBe(480);
			expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
			expect(ctx.stroke).toHaveBeenCalled();
			expect(ctx.lineTo).toHaveBeenCalledWith(640, 480);
		});
	});

	it('does not draw when the pointer is used in image mode', () => {
		openImage();
		const { container } = render(<CanvasWrapper />);
		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		stubBoundingRect(canvas, { width: 320, height: 320, left: 0, top: 0 });

		fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
		fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 100, clientY: 100 });

		expect(ctx.stroke).not.toHaveBeenCalled();
	});
});
