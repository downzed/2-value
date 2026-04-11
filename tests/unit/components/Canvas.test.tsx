import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Canvas from '../../../src/renderer/components/Canvas';
import { createMockContextValue, createMockImage, setupCanvasMock, setupResizeObserverMock } from '../../helpers/mocks';
import { useRef } from 'react';

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

vi.mock('../../../src/renderer/hooks/useImageProcessingWorker', () => ({
	useImageProcessingWorker: vi.fn(() => ({
		process: vi.fn(() => () => {}),
	})),
}));

vi.mock('../../../src/renderer/utils/imageConversion', () => ({
	imageToImageData: vi.fn(() => ({
		data: new Uint8ClampedArray(4 * 100 * 100),
		width: 100,
		height: 100,
	})),
}));

import { useImageContext } from '../../../src/renderer/hooks/ImageContext';

// Wrapper to provide a previewCanvasRef
function CanvasWrapper() {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	return <Canvas previewCanvasRef={previewCanvasRef} />;
}

describe('Canvas', () => {
	beforeEach(() => {
		setupResizeObserverMock();
		setupCanvasMock();
		vi.mocked(useImageContext).mockReturnValue(createMockContextValue() as ReturnType<typeof useImageContext>);
	});

	it('renders empty state with placeholder when no image is loaded', () => {
		render(<CanvasWrapper />);
		expect(screen.getByText('No image loaded')).toBeDefined();
		expect(screen.getByText('Click "Open" to get started')).toBeDefined();
	});

	it('does not render the "No image loaded" placeholder when image is provided', () => {
		const mockImage = createMockImage(100, 100);
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ currentImage: mockImage, hasImage: true }) as ReturnType<typeof useImageContext>,
		);
		render(<CanvasWrapper />);
		expect(screen.queryByText('No image loaded')).toBeNull();
	});

	it('renders a canvas element when image is provided', () => {
		const mockImage = createMockImage(100, 100);
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ currentImage: mockImage, hasImage: true }) as ReturnType<typeof useImageContext>,
		);
		const { container } = render(<CanvasWrapper />);
		const canvas = container.querySelector('canvas');
		expect(canvas).not.toBeNull();
	});
});
