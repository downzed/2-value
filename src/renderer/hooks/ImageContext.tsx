import type React from 'react';
import { createContext, useContext } from 'react';
import { useImage } from './useImage';

type ImageContextValue = ReturnType<typeof useImage>;

const ImageContext = createContext<ImageContextValue | null>(null);

export const ImageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const imageState = useImage();
	return <ImageContext.Provider value={imageState}>{children}</ImageContext.Provider>;
};

export const useImageContext = () => {
	const context = useContext(ImageContext);
	if (!context) {
		throw new Error('useImageContext must be used within an ImageProvider');
	}
	return context;
};
