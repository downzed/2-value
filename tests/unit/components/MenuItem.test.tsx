import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuItem } from '../../../src/renderer/components/shared/MenuItem';

describe('MenuItem', () => {
	it('renders its label and calls onClick', () => {
		const onClick = vi.fn();
		render(<MenuItem onClick={onClick}>Rename</MenuItem>);

    const item = screen.getByRole('menuitem', { name: 'Rename' })
		expect(item).toBeDefined();
		fireEvent.click(item);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('spans the full menu width and stays left-aligned', () => {
		render(<MenuItem onClick={vi.fn()}>Open</MenuItem>);
		const item = screen.getByRole('menuitem');

		expect(item.className).toContain('w-full');
		expect(item.className).toContain('text-left');
	});

	it('does not fire while disabled', () => {
		const onClick = vi.fn();
		render(
			<MenuItem onClick={onClick} disabled>
				Save
			</MenuItem>,
		);

		fireEvent.click(screen.getByRole('menuitem'));

		expect(onClick).not.toHaveBeenCalled();
	});
});
