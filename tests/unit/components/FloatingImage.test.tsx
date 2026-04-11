import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FloatingImage from '../../../src/renderer/components/FloatingImage';
import { createMockContextValue, createMockImage, setupCanvasMock } from '../../helpers/mocks';

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

vi.mock('../../../src/renderer/utils/imageConversion', () => ({
	imageToImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
}));

import { useImageContext } from '../../../src/renderer/hooks/ImageContext';

describe('FloatingImage', () => {
	beforeEach(() => {
		setupCanvasMock();
		vi.mocked(useImageContext).mockReturnValue(createMockContextValue() as ReturnType<typeof useImageContext>);
	});

	it('renders nothing when originalImage is null', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ originalImage: null }) as ReturnType<typeof useImageContext>,
		);
		const { container } = render(<FloatingImage />);
		expect(container.firstChild).toBeNull();
	});

	it('renders canvas when originalImage is provided and panel is open', () => {
		const mockImage = createMockImage(50, 50);
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				originalImage: mockImage,
				panels: { controls: true, original: true, timer: true, gallery: false },
			}) as ReturnType<typeof useImageContext>,
		);
		render(<FloatingImage />);
		expect(screen.getByRole('toolbar')).toBeDefined();
	});

	it('renders nothing when panel is closed (originalImage present)', () => {
		const mockImage = createMockImage(50, 50);
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				originalImage: mockImage,
				panels: { controls: true, original: false, timer: true, gallery: false },
			}) as ReturnType<typeof useImageContext>,
		);
		const { container } = render(<FloatingImage />);
		// FloatingWidget returns null when isOpen=false, but FloatingImage renders it
		// The component itself is still mounted; the panel content is hidden.
		// The toolbar element should not be present.
		expect(container.querySelector('[role="toolbar"]')).toBeNull();
	});

	it('toggle button shows eye-open icon when showOriginal is false', () => {
		const mockImage = createMockImage(50, 50);
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				originalImage: mockImage,
				showOriginal: false,
				panels: { controls: true, original: true, timer: true, gallery: false },
			}) as ReturnType<typeof useImageContext>,
		);
		render(<FloatingImage />);
		// Button title should say "Show Original" when showOriginal is false
		const btn = screen.getByTitle('Show Original');
		expect(btn).toBeDefined();
	});

	it('toggle button shows eye-closed icon when showOriginal is true', () => {
		const mockImage = createMockImage(50, 50);
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				originalImage: mockImage,
				showOriginal: true,
				panels: { controls: true, original: true, timer: true, gallery: false },
			}) as ReturnType<typeof useImageContext>,
		);
		render(<FloatingImage />);
		const btn = screen.getByTitle('Show Processed');
		expect(btn).toBeDefined();
	});

	it('clicking toggle calls toggleShowOriginal', () => {
		const toggleShowOriginal = vi.fn();
		const mockImage = createMockImage(50, 50);
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				originalImage: mockImage,
				showOriginal: false,
				panels: { controls: true, original: true, timer: true, gallery: false },
				toggleShowOriginal,
			}) as ReturnType<typeof useImageContext>,
		);
		render(<FloatingImage />);
		fireEvent.click(screen.getByTitle('Show Original'));
		expect(toggleShowOriginal).toHaveBeenCalled();
	});
});
