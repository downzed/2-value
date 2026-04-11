import { useEffect } from 'react';
import { useImageContext } from './ImageContext';
import { UI } from '../constants/ui';

function isInputFocused(): boolean {
	const tag = document.activeElement?.tagName?.toLowerCase();
	return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function useKeyboardShortcuts() {
	const {
		hasImage,
		blur,
		threshold,
		setBlur,
		setThreshold,
		undo,
		redo,
		canUndo,
		canRedo,
		togglePanel,
		setFitMode,
		zoomIn,
		zoomOut,
	} = useImageContext();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl+Z = Undo
			if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
				e.preventDefault();
				if (canUndo) undo();
				return;
			}

			// Ctrl+Shift+Z = Redo
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
				e.preventDefault();
				if (canRedo) redo();
				return;
			}

			// Alt+1/2/3 = Toggle panels
			if (e.altKey && e.key === '1') {
				e.preventDefault();
				togglePanel('controls');
				return;
			}
			if (e.altKey && e.key === '2') {
				e.preventDefault();
				togglePanel('original');
				return;
			}
			if (e.altKey && e.key === '3') {
				e.preventDefault();
				togglePanel('timer');
				return;
			}

			// Ctrl+0 = Fit to view
			if ((e.ctrlKey || e.metaKey) && e.key === '0') {
				e.preventDefault();
				if (hasImage) setFitMode('fit');
				return;
			}

			// Ctrl+= = Zoom in
			if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
				e.preventDefault();
				if (hasImage) zoomIn();
				return;
			}

			// Ctrl+- = Zoom out
			if ((e.ctrlKey || e.metaKey) && e.key === '-') {
				e.preventDefault();
				if (hasImage) zoomOut();
				return;
			}

			// h/j/k/l vim-style adjustment keybinds
			// Only when no modifier keys and not focused on an input
			if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
			if (isInputFocused()) return;
			if (!hasImage) return;

			switch (e.key) {
				case 'h': {
					e.preventDefault();
					const next = Math.max(UI.FILTER.BLUR_MIN, blur - UI.FILTER.BLUR_STEP);
					setBlur(next);
					break;
				}
				case 'l': {
					e.preventDefault();
					const next = Math.min(UI.FILTER.BLUR_MAX, blur + UI.FILTER.BLUR_STEP);
					setBlur(next);
					break;
				}
				case 'j': {
					e.preventDefault();
					const next = Math.max(UI.FILTER.THRESHOLD_MIN, threshold - UI.FILTER.THRESHOLD_STEP);
					setThreshold(next);
					break;
				}
				case 'k': {
					e.preventDefault();
					const next = Math.min(UI.FILTER.THRESHOLD_MAX, threshold + UI.FILTER.THRESHOLD_STEP);
					setThreshold(next);
					break;
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		hasImage,
		blur,
		threshold,
		setBlur,
		setThreshold,
		undo,
		redo,
		canUndo,
		canRedo,
		togglePanel,
		setFitMode,
		zoomIn,
		zoomOut,
	]);
}
