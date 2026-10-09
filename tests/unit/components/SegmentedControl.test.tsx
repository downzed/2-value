import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from '../../../src/renderer/components/shared/SegmentedControl';

const OPTIONS = [
	{ value: 'a', label: 'A' },
	{ value: 'b', label: 'B' },
	{ value: 'c', label: 'C' },
];

describe('SegmentedControl', () => {
	it('renders one button per option', () => {
		render(<SegmentedControl options={OPTIONS} value='a' onChange={vi.fn()} />);

		expect(screen.getAllByRole('button')).toHaveLength(3);
		expect(screen.getByRole('button', { name: 'B' })).toBeDefined();
	});

	it('marks only the matching option as pressed', () => {
		render(<SegmentedControl options={OPTIONS} value='b' onChange={vi.fn()} />);

		expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByRole('button', { name: 'B' }).getAttribute('aria-pressed')).toBe('true');
	});

	it('leaves every option unpressed when nothing matches', () => {
		render(<SegmentedControl options={OPTIONS} value='' onChange={vi.fn()} />);

		for (const button of screen.getAllByRole('button')) {
			expect(button.getAttribute('aria-pressed')).toBe('false');
		}
	});

	it('reports the clicked option value', () => {
		const onChange = vi.fn();
		render(<SegmentedControl options={OPTIONS} value='a' onChange={onChange} />);

		fireEvent.click(screen.getByRole('button', { name: 'C' }));

		expect(onChange).toHaveBeenCalledWith('c');
	});

	it('works with numeric values', () => {
		const onChange = vi.fn();
		render(
			<SegmentedControl
				options={[
					{ value: 2, label: '2' },
					{ value: 3, label: '3' },
				]}
				value={2}
				onChange={onChange}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: '3' }));

		expect(onChange).toHaveBeenCalledWith(3);
	});

	it('disables every button together', () => {
		render(<SegmentedControl options={OPTIONS} value='a' onChange={vi.fn()} disabled />);

		for (const button of screen.getAllByRole('button')) {
			expect(button.hasAttribute('disabled')).toBe(true);
		}
	});

	it('forwards a per-option title', () => {
		render(
			<SegmentedControl
				options={[
					{ value: 'a', label: 'A', title: 'Actual Size' },
					{ value: 'b', label: 'B' },
				]}
				value='a'
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByRole('button', { name: 'A' }).getAttribute('title')).toBe('Actual Size');
		expect(screen.getByRole('button', { name: 'B' }).getAttribute('title')).toBeNull();
	});

	it('applies a different palette per tone', () => {
		const { rerender } = render(<SegmentedControl options={OPTIONS} value='a' onChange={vi.fn()} tone='light' />);
		const lightActive = screen.getByRole('button', { name: 'A' }).className;

		rerender(<SegmentedControl options={OPTIONS} value='a' onChange={vi.fn()} tone='dark' />);
		const darkActive = screen.getByRole('button', { name: 'A' }).className;

		// The two call sites render on white panels and a slate bar respectively,
		// so the tone has to reach the button's own classes.
		expect(lightActive).not.toBe(darkActive);
		expect(lightActive).toContain('bg-white');
		expect(darkActive).toContain('bg-slate-500');
	});
});
