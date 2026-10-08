import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FloatingCounter from '../../../src/renderer/components/FloatingCounter';
import { createEditorState, createEditorStoreStub, createOpenItem } from '../../helpers/mocks';

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
	useGallerySelector: (selector: (s: never) => unknown) => selector({}),
}));

// FloatingWidget uses useDraggablePanel which uses localStorage (already mocked in setup.ts)

type EditorStateLike = ReturnType<typeof createEditorState>;
let editorState: { current: EditorStateLike };
let editorStub: ReturnType<typeof createEditorStoreStub>;

/** Sets editor state from the legacy flat-field overrides the tests used. */
function setState(overrides: Record<string, unknown>) {
	editorState.current = createEditorState(translate(overrides));
}

/** Maps legacy flat fields onto the item-based EditorState shape. */
function translate(overrides: Record<string, unknown>): Partial<EditorStateLike> {
	const { blur, threshold, values, showOriginal, canUndo, canRedo, history, future, ...rest } = overrides;
	const needsItem =
		blur !== undefined ||
		threshold !== undefined ||
		values !== undefined ||
		showOriginal !== undefined ||
		canUndo !== undefined ||
		canRedo !== undefined;
	if (!needsItem) return rest as Partial<EditorStateLike>;
	return {
		...rest,
		items: [createOpenItem({ blur, threshold, values, showOriginal })],
		activeItemId: 'item-1',
	} as Partial<EditorStateLike>;
}

/** Applies store-action spies onto the editor stub. */
function useActions(actions: Record<string, unknown>) {
	Object.assign(editorStub, actions);
}

describe('FloatingCounter', () => {
	beforeEach(() => {
		editorState = { current: createEditorState() };
		editorStub = createEditorStoreStub();
		holders.getEditorState = () => editorState.current;
		holders.getEditorStore = () => editorStub;
	});

	it('renders preset buttons (1m, 5m, 10m, 15m)', () => {
		render(<FloatingCounter />);
		expect(screen.getByText('1m')).toBeDefined();
		expect(screen.getByText('5m')).toBeDefined();
		expect(screen.getByText('10m')).toBeDefined();
		expect(screen.getByText('15m')).toBeDefined();
	});

	it('renders nothing when panels.timer is false', () => {
		setState({ panels: { controls: true, original: true, timer: false, gallery: false } });
		const { container } = render(<FloatingCounter />);
		expect(container.firstChild).toBeNull();
	});

	it('clicking a preset calls startCounter with the correct duration', async () => {
		const startCounter = vi.fn();
		useActions({ startCounter });
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('5m'));
		expect(startCounter).toHaveBeenCalledWith(300);
	});

	it('displays countdown in MM:SS format for durations >= 1 minute', () => {
		setState({ counter: 125, counterRunning: true, counterDuration: 300 });
		render(<FloatingCounter />);
		expect(screen.getByText('2:05')).toBeDefined();
	});

	it('displays countdown in seconds for durations < 1 minute', () => {
		setState({ counter: 42, counterRunning: true, counterDuration: 60 });
		render(<FloatingCounter />);
		expect(screen.getByText('42')).toBeDefined();
	});

	it('shows Stop button when timer is running', () => {
		setState({ counter: 60, counterRunning: true, counterDuration: 60 });
		render(<FloatingCounter />);
		expect(screen.getByText('Stop')).toBeDefined();
	});

	it('shows Start button when timer is not running', () => {
		setState({ counter: 0, counterRunning: false, counterDuration: 60 });
		render(<FloatingCounter />);
		expect(screen.getByText('Start')).toBeDefined();
	});

	it('Reset button calls stopCounter', async () => {
		const stopCounter = vi.fn();
		useActions({ stopCounter });
		setState({ counter: 30, counterRunning: true, counterDuration: 60 });
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('Reset'));
		expect(stopCounter).toHaveBeenCalled();
	});

	it('Start/Stop button toggles: Stop calls stopCounter', async () => {
		const stopCounter = vi.fn();
		useActions({ stopCounter });
		setState({ counter: 60, counterRunning: true, counterDuration: 60 });
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('Stop'));
		expect(stopCounter).toHaveBeenCalled();
	});

	it('Start button calls startCounter with counterDuration when not running', async () => {
		const startCounter = vi.fn();
		useActions({ startCounter });
		setState({ counter: 0, counterRunning: false, counterDuration: 300 });
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('Start'));
		expect(startCounter).toHaveBeenCalledWith(300);
	});
});
