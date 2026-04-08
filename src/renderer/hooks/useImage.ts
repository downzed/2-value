import type { Image } from "image-js";
import { useCallback, useState } from "react";

interface ImageState {
  currentImage: Image | null;
  originalImage: Image | null;
  fileName: string;

  // Values study adjustments
  blur: number;
  threshold: number;
  invert: boolean;
}

export const useImage = () => {
  const [imageState, setImageState] = useState<ImageState>({
    currentImage: null,
    originalImage: null,
    fileName: "",
    blur: 0,
    threshold: 0,
    invert: false,
  });

  const { currentImage, originalImage, fileName, blur, threshold, invert } =
    imageState;

  // Load image (already decoded)
  const loadImage = useCallback(async (image: Image, fileName: string = "") => {
    setImageState({
      currentImage: image.clone(),
      originalImage: image.clone(),
      fileName,
      blur: 0,
      threshold: 0,
      invert: false,
    });
  }, []);

  // Reset image (clear all)
  const resetImage = useCallback(() => {
    setImageState({
      currentImage: null,
      originalImage: null,
      fileName: "",
      blur: 0,
      threshold: 0,
      invert: false,
    });
  }, []);

  // Reset controls only (keep image)
  const resetControls = useCallback(() => {
    setImageState((prev) => ({
      ...prev,
      blur: 0,
      threshold: 0,
      invert: false,
    }));
  }, []);

  // Adjustments setters
  const setBlur = useCallback((value: number) => {
    setImageState((prev) => ({ ...prev, blur: value }));
  }, []);

  const setThreshold = useCallback((value: number) => {
    setImageState((prev) => ({ ...prev, threshold: value }));
  }, []);

  const setInvert = useCallback((enabled: boolean) => {
    setImageState((prev) => ({ ...prev, invert: enabled }));
  }, []);

  return {
    // State
    currentImage,
    originalImage,
    fileName,
    hasImage: !!currentImage,

    // Actions
    loadImage,
    resetImage,
    resetControls,

    // Values study adjustments
    blur,
    threshold,
    invert,
    setBlur,
    setThreshold,
    setInvert,
  };
};
