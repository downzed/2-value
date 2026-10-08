import type React from 'react';
import { useEffect, useRef } from 'react';
import { ImageProvider } from '../../hooks/ImageContext';
import { GalleryProvider } from '../../hooks/GalleryContext';
import { KeyboardCommands } from '../../core/KeyboardCommands';
import { SessionRestorer } from '../../core/SessionRestorer';
import { UnsavedGuard } from '../../core/UnsavedGuard';
import { getAppStore } from '../../core/store';
import BottomPanel from './BottomPanel';
import GalleryPanel from './GalleryPanel';
import Canvas from '../Canvas';
import FloatingControls from '../FloatingControls';
import FloatingCounter from '../FloatingCounter';
import FloatingImage from '../FloatingImage';

const AppContent: React.FC = () => {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	const store = getAppStore();

	const { commands } = store;

	/**
	 * App-wide side effects that are not React state: keyboard bindings, the
	 * unsaved-changes warning, and restoring the previous session's items.
	 * Each class owns its own subscription and is stopped on unmount.
	 */
	useEffect(() => {
		const keyboard = new KeyboardCommands(store.editor);
		const guard = new UnsavedGuard(store.editor);
		const restorer = new SessionRestorer({
			editor: store.editor,
			gallery: store.gallery,
			openFile: commands.openFile,
		});

		keyboard.start();
		guard.start();
		restorer.start();

		return () => {
			keyboard.stop();
			guard.stop();
			restorer.stop();
		};
	}, [commands, store]);

	return (
		<div className='flex flex-col h-screen bg-slate-100'>
			<div className='flex-1 flex flex-col overflow-hidden'>
				<Canvas previewCanvasRef={previewCanvasRef} />
				<FloatingImage />
				<FloatingControls />
				<FloatingCounter />
				<GalleryPanel />
				<BottomPanel previewCanvasRef={previewCanvasRef} />
			</div>
		</div>
	);
};

const App: React.FC = () => {
	return (
		<ImageProvider>
			<GalleryProvider>
				<AppContent />
			</GalleryProvider>
		</ImageProvider>
	);
};

export default App;
