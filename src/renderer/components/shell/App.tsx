import type React from 'react';
import { useRef } from 'react';
import { ImageProvider } from '../../hooks/ImageContext';
import { GalleryProvider } from '../../hooks/GalleryContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import BottomPanel from './BottomPanel';
import GalleryPanel from './GalleryPanel';
import Canvas from '../Canvas';
import FloatingControls from '../FloatingControls';
import FloatingCounter from '../FloatingCounter';
import FloatingImage from '../FloatingImage';

const AppContent: React.FC = () => {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	useKeyboardShortcuts();

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
