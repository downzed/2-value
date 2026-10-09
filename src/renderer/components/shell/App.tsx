import type React from 'react';
import { useEffect, useRef } from 'react';
import { KeyboardCommands } from '../../core/KeyboardCommands';
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

	/**
	 * App-wide side effects that are not React state: keyboard bindings and the
	 * unsaved-changes warning. Each class owns its own subscription and is
	 * stopped on unmount.
	 *
	 * Nothing is restored on reload: the app starts with nothing open and the
	 * gallery suggests recently opened images instead.
	 */
	useEffect(() => {
		const keyboard = new KeyboardCommands(store.editor);
		const guard = new UnsavedGuard(store.editor);

		keyboard.start();
		guard.start();

		return () => {
			keyboard.stop();
			guard.stop();
		};
	}, [store]);

	return (
		<div className='flex flex-col h-screen bg-slate-100'>
			{/* Menu / status bar sits above the stage. */}
			<BottomPanel previewCanvasRef={previewCanvasRef} />
			<div className='flex-1 flex flex-col overflow-hidden'>
				<Canvas previewCanvasRef={previewCanvasRef} />
				<FloatingImage />
				<FloatingControls />
				<FloatingCounter />
				<GalleryPanel />
			</div>
		</div>
	);
};

const App: React.FC = () => <AppContent />;

export default App;
