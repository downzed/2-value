import type React from 'react';
import { useRef } from 'react';
import { ImageProvider } from '../hooks/ImageContext';
import BottomPanel from './BottomPanel';
import Canvas from './Canvas';
import FloatingControls from './FloatingControls';
import FloatingCounter from './FloatingCounter';
import FloatingImage from './FloatingImage';

const App: React.FC = () => {
	const previewCanvasRef = useRef<HTMLCanvasElement>(null);

	return (
		<ImageProvider>
			<div className='flex flex-col h-screen bg-slate-100'>
				<div className='flex-1 flex flex-col overflow-hidden'>
					<Canvas previewCanvasRef={previewCanvasRef} />
					<FloatingImage />
					<FloatingControls />
					<FloatingCounter />
					<BottomPanel previewCanvasRef={previewCanvasRef} />
				</div>
			</div>
		</ImageProvider>
	);
};

export default App;
