import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRef } from 'react';
import BottomPanel from '../../../src/renderer/components/shell/BottomPanel';
import { createMockContextValue } from '../../helpers/mocks';

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

vi.mock('../../../src/renderer/hooks/GalleryContext', () => ({
	useGalleryContext: vi.fn(() => ({
		folders: [],
		images: [],
		filteredImages: [],
		selectedFolderId: null,
		gallerySearchQuery: '',
		loading: false,
		error: null,
		loadGallery: vi.fn(),
		createFolder: vi.fn(),
		renameFolder: vi.fn(),
		deleteFolder: vi.fn(),
		updateFolderTags: vi.fn(),
		importImage: vi.fn(),
		moveImage: vi.fn(),
		copyImage: vi.fn(),
		deleteImage: vi.fn(),
		openGalleryImage: vi.fn(),
		setSelectedFolder: vi.fn(),
		setGallerySearchQuery: vi.fn(),
		clearError: vi.fn(),
	})),
}));

vi.mock('../../../src/renderer/hooks/useImageLoader', () => ({
	useImageLoader: vi.fn(() => ({
		loadFromFile: vi.fn().mockResolvedValue({ ok: true }),
	})),
	imageLoadErrorMessage: vi.fn((e: string) => e),
}));

import { useImageContext } from '../../../src/renderer/hooks/ImageContext';

function BottomPanelWrapper() {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	return <BottomPanel previewCanvasRef={previewCanvasRef} />;
}

describe('BottomPanel', () => {
	beforeEach(() => {
		vi.mocked(useImageContext).mockReturnValue(createMockContextValue() as ReturnType<typeof useImageContext>);
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
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ newBlankCanvas }) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		fireEvent.click(screen.getByText('New'));
		expect(newBlankCanvas).toHaveBeenCalled();
	});

	it('Ctrl+N starts a blank canvas without any image loaded', () => {
		const newBlankCanvas = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ hasImage: false, hasCanvas: false, newBlankCanvas }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<BottomPanelWrapper />);
		fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
		expect(newBlankCanvas).toHaveBeenCalled();
	});

	it('Ctrl+N fires when an image is already open', () => {
		const newBlankCanvas = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ hasImage: true, hasCanvas: true, newBlankCanvas }) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
		expect(newBlankCanvas).toHaveBeenCalledTimes(1);
	});

	it('does not fire New on an unrelated shortcut', () => {
		const newBlankCanvas = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ newBlankCanvas }) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
		fireEvent.keyDown(window, { key: 'n' });
		expect(newBlankCanvas).not.toHaveBeenCalled();
	});

	it('displays blank canvas dimensions from the stage size', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				canvasMode: 'blank' as const,
				hasBlankCanvas: true,
				hasCanvas: true,
				viewport: { width: 1024, height: 768 },
			}) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		expect(screen.getByText('1024 × 768')).toBeDefined();
	});

	it('Save button is disabled when no image is loaded', () => {
		render(<BottomPanelWrapper />);
		const saveBtn = screen.getByText('Save').closest('button');
		expect(saveBtn?.disabled).toBe(true);
	});

	it('Save button is enabled when image is loaded', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ hasImage: true, hasCanvas: true }) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		const saveBtn = screen.getByText('Save').closest('button');
		expect(saveBtn?.disabled).toBe(false);
	});

	it('Save button is enabled for a blank canvas even though no image is loaded', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				hasImage: false,
				hasCanvas: true,
				hasBlankCanvas: true,
				canvasMode: 'blank' as const,
			}) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		const saveBtn = screen.getByText('Save').closest('button');
		expect(saveBtn?.disabled).toBe(false);
	});

	it('displays file name when image is loaded', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ hasImage: true, fileName: 'photo.jpg' }) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		expect(screen.getByText('photo.jpg')).toBeDefined();
	});

	it('displays image dimensions when image is loaded', () => {
		const mockImage = { width: 800, height: 600 };
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ hasImage: true, currentImage: mockImage }) as ReturnType<typeof useImageContext>,
		);
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
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				panels: { controls: false, original: true, timer: true, gallery: false },
			}) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		const btn = screen.getByTitle('Show Adjustments (Alt+1)');
		expect(btn).toBeDefined();
	});

	it('clicking minimized controls icon calls setPanel to reopen it', () => {
		const setPanel = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				panels: { controls: false, original: true, timer: true, gallery: false },
				setPanel,
			}) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		fireEvent.click(screen.getByTitle('Show Adjustments (Alt+1)'));
		expect(setPanel).toHaveBeenCalledWith('controls', true);
	});

	it('shows zoom controls when image is loaded', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ hasImage: true }) as ReturnType<typeof useImageContext>,
		);
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
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ hasImage: true, effectiveZoom: 0.5 }) as ReturnType<typeof useImageContext>,
		);
		render(<BottomPanelWrapper />);
		expect(screen.getByText('50%')).toBeDefined();
	});
});
