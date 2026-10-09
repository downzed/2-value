import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GridTile, TileGrid } from '../../../src/renderer/components/gallery/GridTile';
import { UI } from '../../../src/renderer/constants/ui';

describe('TileGrid', () => {
	it('lays children out in the configured column count', () => {
		const { container } = render(
			<TileGrid>
				<span>a</span>
			</TileGrid>,
		);
		const grid = container.firstChild as HTMLElement;
		// Tailwind supplies `display: grid`; jsdom has no CSS, so assert the class
		// and the inline column count that actually drives the layout.
		expect(grid.className).toContain('grid');
		expect(grid.style.gridTemplateColumns).toBe(`repeat(${UI.GALLERY.THUMBNAIL_COLS}, minmax(0, 1fr))`);
	});
});

describe('GridTile', () => {
	it('renders the thumbnail when a src is given', () => {
		render(<GridTile src='blob:x' alt='photo' ariaLabel='Open photo' onClick={vi.fn()} />);
		const img = screen.getByAltText('photo');
		expect(img.getAttribute('src')).toBe('blob:x');
	});

	it('falls back to a placeholder when there is no src', () => {
		const { container } = render(<GridTile alt='photo' ariaLabel='Open photo' onClick={vi.fn()} />);
		expect(container.querySelector('img')).toBeNull();
		expect(container.querySelector('.animate-pulse')).not.toBeNull();
	});

	it('renders a caption only when given', () => {
		const { container, rerender } = render(<GridTile alt='a' ariaLabel='a' onClick={vi.fn()} />);
		expect(container.querySelector('.bg-black\\/60')).toBeNull();
		rerender(<GridTile alt='a' ariaLabel='a' caption='Canvas 1' onClick={vi.fn()} />);
		expect(screen.getByText('Canvas 1')).toBeDefined();
	});

	it('shows the loading overlay when loading', () => {
		render(<GridTile alt='a' ariaLabel='a' loading onClick={vi.fn()} />);
		expect(screen.getByText('Loading...')).toBeDefined();
	});

	it('shows the unsaved dot only when dot is set', () => {
		const { container, rerender } = render(<GridTile alt='a' ariaLabel='a' onClick={vi.fn()} />);
		expect(container.querySelector('.bg-amber-500')).toBeNull();
		rerender(<GridTile alt='a' ariaLabel='a' dot onClick={vi.fn()} />);
		expect(container.querySelector('.bg-amber-500')).not.toBeNull();
	});

	it('calls onClick', () => {
		const onClick = vi.fn();
		render(<GridTile alt='a' ariaLabel='a' onClick={onClick} />);
		fireEvent.click(screen.getByRole('button'));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('passes the context menu event through', () => {
		const onContextMenu = vi.fn();
		render(<GridTile alt='a' ariaLabel='a' onClick={vi.fn()} onContextMenu={onContextMenu} />);
		fireEvent.contextMenu(screen.getByRole('button'));
		expect(onContextMenu).toHaveBeenCalledTimes(1);
	});

	it('applies the selected ring', () => {
		const { container } = render(<GridTile alt='a' ariaLabel='a' selected onClick={vi.fn()} />);
		expect(container.querySelector('.ring-1')).not.toBeNull();
	});

	it('exposes an accessible name', () => {
		render(<GridTile alt='a' ariaLabel='Continue Canvas 1' onClick={vi.fn()} />);
		expect(screen.getByRole('button', { name: 'Continue Canvas 1' })).toBeDefined();
	});
});
