import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FileMenu from '../../../src/renderer/components/shell/FileMenu';
import type { FileMenuItem } from '../../../src/renderer/components/shell/FileMenu';

function setup(items?: Partial<FileMenuItem>[]) {
	const onNew = vi.fn();
	const defaults: FileMenuItem[] = [
		{ id: 'new', label: 'New', shortcut: 'Ctrl+N', onSelect: onNew },
		{ id: 'open', label: 'Open', shortcut: 'Ctrl+O', onSelect: vi.fn() },
		{
			id: 'save',
			label: 'Save',
			shortcut: 'Ctrl+S',
			description: 'Write to the gallery',
			onSelect: vi.fn(),
		},
		{ id: 'export', label: 'Export as...', description: 'Download a PNG or JPEG', onSelect: vi.fn() },
	];
	render(<FileMenu items={defaults.map((d, i) => ({ ...d, ...items?.[i] }))} />);
	return { onNew };
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'File' }));

describe('FileMenu', () => {
	it('shows only the File button until opened', () => {
		setup();
		expect(screen.getByRole('button', { name: 'File' })).toBeDefined();
		expect(screen.queryByText('Export as...')).toBeNull();
	});

	it('reveals every item when opened', () => {
		setup();
		openMenu();
		expect(screen.getByText('New')).toBeDefined();
		expect(screen.getByText('Open')).toBeDefined();
		expect(screen.getByText('Save')).toBeDefined();
		expect(screen.getByText('Export as...')).toBeDefined();
	});

	it('shows shortcut hints', () => {
		setup();
		openMenu();
		expect(screen.getByText('Ctrl+N')).toBeDefined();
		expect(screen.getByText('Ctrl+S')).toBeDefined();
	});

	it('shows descriptions only where they were supplied', () => {
		setup();
		openMenu();
		// New/Open get a shortcut only; Save/Export also get a second line.
		expect(screen.getByText('New').closest('button')?.textContent).toBe('NewCtrl+N');
		expect(screen.getByText('Open').closest('button')?.textContent).toBe('OpenCtrl+O');
		expect(screen.getByText('Save').closest('button')?.textContent).toBe('SaveCtrl+SWrite to the gallery');
		expect(screen.getByText('Export as...').closest('button')?.textContent).toBe('Export as...Download a PNG or JPEG');
	});

	it('runs the selected item then closes', () => {
		const { onNew } = setup();
		openMenu();
		fireEvent.click(screen.getByText('New'));
		expect(onNew).toHaveBeenCalledTimes(1);
		expect(screen.queryByText('Export as...')).toBeNull();
	});

	it('does not run a disabled item', () => {
		const onSave = vi.fn();
		setup([undefined, undefined, { disabled: true, onSelect: onSave }]);
		openMenu();
		const save = screen.getByText('Save').closest('button');
		expect(save?.disabled).toBe(true);
		fireEvent.click(save as HTMLButtonElement);
		expect(onSave).not.toHaveBeenCalled();
	});

	it('closes on Escape', () => {
		setup();
		openMenu();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.queryByText('Export as...')).toBeNull();
	});

	it('closes on outside mousedown', () => {
		setup();
		openMenu();
		fireEvent.mouseDown(document.body);
		expect(screen.queryByText('Export as...')).toBeNull();
	});

	it('stays open on a mousedown inside the menu', () => {
		setup();
		openMenu();
		fireEvent.mouseDown(screen.getByText('New'));
		expect(screen.getByText('Export as...')).toBeDefined();
	});

	it('toggles closed when the trigger is clicked again', () => {
		setup();
		openMenu();
		openMenu();
		expect(screen.queryByText('Export as...')).toBeNull();
	});

	it('marks the trigger expanded while open', () => {
		setup();
		openMenu();
		expect(screen.getByRole('button', { name: 'File' }).getAttribute('aria-expanded')).toBe('true');
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.getByRole('button', { name: 'File' }).getAttribute('aria-expanded')).toBe('false');
	});
});
