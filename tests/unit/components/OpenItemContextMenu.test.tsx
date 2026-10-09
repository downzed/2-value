import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OpenItemContextMenu } from '../../../src/renderer/components/gallery/OpenItemContextMenu';
import type { OpenItem } from '../../../src/renderer/core/types';
import { createOpenItem } from '../../helpers/mocks';

const makeItem = (overrides: Partial<OpenItem> = {}): OpenItem =>
	createOpenItem({ kind: 'blank', label: 'Canvas 1', fileName: '', image: null, ...overrides });

function renderMenu(overrides: Partial<OpenItem> = {}) {
	const handlers = {
		onCloseMenu: vi.fn(),
		onOpen: vi.fn(),
		onCloseItem: vi.fn(),
		onSave: vi.fn(),
		onExport: vi.fn(),
	};
	render(
		<OpenItemContextMenu
			item={makeItem(overrides)}
			anchorX={10}
			anchorY={20}
			onCloseMenu={handlers.onCloseMenu}
			onOpen={handlers.onOpen}
			onCloseItem={handlers.onCloseItem}
			onSave={handlers.onSave}
			onExport={handlers.onExport}
		/>,
	);
	return handlers;
}

describe('OpenItemContextMenu', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('offers open, save, export and close', () => {
		renderMenu();
		expect(screen.getByText('Open')).toBeDefined();
		expect(screen.getByText('Save to gallery')).toBeDefined();
		expect(screen.getByText('Export as...')).toBeDefined();
		expect(screen.getByText('Close')).toBeDefined();
	});

	it('activates the item on Open', () => {
		const h = renderMenu();
		fireEvent.click(screen.getByText('Open'));
		expect(h.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
		expect(h.onCloseMenu).toHaveBeenCalled();
	});

	it('saves the item on Save to gallery', () => {
		const h = renderMenu();
		fireEvent.click(screen.getByText('Save to gallery'));
		expect(h.onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
	});

	it('exports the item on Export as...', () => {
		const h = renderMenu();
		fireEvent.click(screen.getByText('Export as...'));
		expect(h.onExport).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
	});

	it('closes the item on Close', () => {
		const h = renderMenu();
		fireEvent.click(screen.getByText('Close'));
		expect(h.onCloseItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
		expect(h.onCloseMenu).toHaveBeenCalled();
	});

	it('dismisses on Escape', () => {
		const h = renderMenu();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(h.onCloseMenu).toHaveBeenCalled();
	});

	it('dismisses on outside mousedown', () => {
		const h = renderMenu();
		fireEvent.mouseDown(document.body);
		expect(h.onCloseMenu).toHaveBeenCalled();
	});

	it('stays open when clicking inside the menu', () => {
		const h = renderMenu();
		fireEvent.mouseDown(screen.getByText('Open'));
		expect(h.onCloseMenu).not.toHaveBeenCalled();
	});
});
