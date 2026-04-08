import type { Image } from "image-js";
import type React from "react";
import { createContext, useContext } from "react";
import { useImage } from "./useImage";

interface ImageContextValue {
  currentImage: Image | null;
  originalImage: Image | null;
  fileName: string;
  loadImage: (image: Image, fileName?: string) => Promise<void>;
  resetImage: () => void;
  resetControls: () => void;
  hasImage: boolean;

  // Core adjustments
  blur: number;
  threshold: number;
  invert: boolean;
  setBlur: (value: number) => void;
  setThreshold: (value: number) => void;
  setInvert: (enabled: boolean) => void;
}

const ImageContext = createContext<ImageContextValue | null>(null);

export const ImageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const imageState = useImage();
  return (
    <ImageContext.Provider value={imageState}>{children}</ImageContext.Provider>
  );
};

export const useImageContext = () => {
  const context = useContext(ImageContext);
  if (!context) {
    throw new Error("useImageContext must be used within an ImageProvider");
  }
  return context;
};
