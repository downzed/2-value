import type React from 'react';
import { useRef } from 'react';
import { ImageProvider } from '../../hooks/ImageContext';
import { PinterestProvider } from '../../context/PinterestContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import BottomPanel from './BottomPanel';
import GalleryPanel from './GalleryPanel';
import Canvas from '../Canvas';
import FloatingControls from '../FloatingControls';
import FloatingCounter from '../FloatingCounter';
import FloatingImage from '../FloatingImage';
import PinterestPanel from '../PinterestPanel';
import { useImageContext } from '../../hooks/ImageContext';

const AppContent: React.FC = () => {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);
	const { panels, setPanel } = useImageContext();
	useKeyboardShortcuts();

	return (
		<div className='flex flex-col h-screen bg-slate-100'>
			<div className='flex-1 flex flex-col overflow-hidden'>
				<Canvas previewCanvasRef={previewCanvasRef} />
				<FloatingImage />
				<FloatingControls />
				<FloatingCounter />
				<GalleryPanel />
				<PinterestPanel
					previewCanvasRef={previewCanvasRef}
					isOpen={panels.pinterest}
					onClose={() => setPanel('pinterest', false)}
				/>
				<BottomPanel previewCanvasRef={previewCanvasRef} />
			</div>
		</div>
	);
};

const App: React.FC = () => {
	return (
		<ImageProvider>
			<PinterestProvider>
				<AppContent />
			</PinterestProvider>
		</ImageProvider>
	);
};

export default App;
