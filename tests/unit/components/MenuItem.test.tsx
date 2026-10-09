import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuItem } from '../../../src/renderer/components/shared/MenuItem';

describe('MenuItem', () => {
	it('renders its label and calls onClick', () => {
		const onClick = vi.fn();
		render(<MenuItem onClick={onClick}>Rename</MenuItem>);

		fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('is a plain button by default, with no menu role', () => {
		render(<MenuItem onClick={vi.fn()}>Open</MenuItem>);

		const item = screen.getByRole('button');
		expect(item.getAttribute('type')).toBe('button');
		expect(item.getAttribute('role')).toBeNull();
	});

	it('adopts menuitem role when the surrounding element is a menu', () => {
		render(
			<div role='menu'>
				<MenuItem role='menuitem' onClick={vi.fn()}>
					Open
				</MenuItem>
			</div>,
		);

		expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
	});

	it('spans the full menu width and stays left-aligned', () => {
		render(<MenuItem onClick={vi.fn()}>Open</MenuItem>);
		const item = screen.getByRole('button');

		expect(item.className).toContain('w-full');
		expect(item.className).toContain('text-left');
	});

	it('colours destructive and muted rows differently', () => {
		const { rerender } = render(<MenuItem onClick={vi.fn()}>Open</MenuItem>);
		const normal = screen.getByRole('button').className;

		rerender(
			<MenuItem tone='danger' onClick={vi.fn()}>
				Delete
			</MenuItem>,
		);
		const danger = screen.getByRole('button').className;

		rerender(
			<MenuItem tone='muted' onClick={vi.fn()}>
				Back
			</MenuItem>,
		);
		const muted = screen.getByRole('button').className;

		expect(normal).not.toBe(danger);
		expect(normal).not.toBe(muted);
		expect(danger).toContain('text-red-600');
		expect(muted).toContain('text-slate-400');
	});

	it('does not fire while disabled', () => {
		const onClick = vi.fn();
		render(
			<MenuItem onClick={onClick} disabled>
				Save
			</MenuItem>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).not.toHaveBeenCalled();
	});
});
