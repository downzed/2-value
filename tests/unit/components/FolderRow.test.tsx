import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FolderRow } from '../../../src/renderer/components/gallery/FolderRow';
import { NewFolderCard } from '../../../src/renderer/components/gallery/NewFolderCard';

describe('FolderRow', () => {
	it('shows a title and a pre-formatted subtitle', () => {
		render(<FolderRow title='Refs' subtitle='3 images' ariaLabel='Open folder Refs' onClick={vi.fn()} />);

		expect(screen.getByText('Refs')).toBeDefined();
		expect(screen.getByText('3 images')).toBeDefined();
	});

	it('uses the aria label as the accessible name', () => {
		render(<FolderRow title='Refs' subtitle='3 images' ariaLabel='Open folder Refs' onClick={vi.fn()} />);

		expect(screen.getByRole('button', { name: 'Open folder Refs' })).toBeDefined();
	});

	it('calls onClick', () => {
		const onClick = vi.fn();
		render(<FolderRow title='Refs' subtitle='3 images' ariaLabel='Open folder Refs' onClick={onClick} />);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('weights the strong variant more heavily', () => {
		const { rerender } = render(
			<FolderRow title='Refs' subtitle='3 images' ariaLabel='Open folder Refs' onClick={vi.fn()} />,
		);
		const normal = screen.getByText('Refs').className;

		rerender(
			<FolderRow
				emphasis='strong'
				title='Opened Items'
				subtitle='2 open items'
				ariaLabel='Open Opened Items folder'
				onClick={vi.fn()}
			/>,
		);
		const strong = screen.getByText('Opened Items').className;

		expect(normal).toContain('font-medium');
		expect(strong).toContain('font-semibold');
	});
});

describe('NewFolderCard', () => {
	it('labels itself as the new-folder action', () => {
		render(<NewFolderCard onClick={vi.fn()} />);

		expect(screen.getByText('+ New Folder')).toBeDefined();
	});

	it('calls onClick', () => {
		const onClick = vi.fn();
		render(<NewFolderCard onClick={onClick} />);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('is drawn as a dashed outline', () => {
		render(<NewFolderCard onClick={vi.fn()} />);

		expect(screen.getByRole('button').className).toContain('border-dashed');
	});
});
