import type React from 'react';
import { createContext, useContext } from 'react';
import { useGallery } from './useGallery';

type GalleryContextValue = ReturnType<typeof useGallery>;

const GalleryContext = createContext<GalleryContextValue | null>(null);

export const GalleryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const galleryState = useGallery();
	return <GalleryContext.Provider value={galleryState}>{children}</GalleryContext.Provider>;
};

export const useGalleryContext = () => {
	const context = useContext(GalleryContext);
	if (!context) {
		throw new Error('useGalleryContext must be used within a GalleryProvider');
	}
	return context;
};
