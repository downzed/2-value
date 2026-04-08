import { readImg } from "image-js";
import type React from "react";
import { useImageContext } from "../hooks/ImageContext";

interface BottomPanelProps {
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ previewCanvasRef }) => {
  const { hasImage, currentImage, fileName, loadImage } = useImageContext();

  const width = currentImage?.width ?? "--";
  const height = currentImage?.height ?? "--";

  const handleOpen = async () => {
    try {
      const result = await window.electronAPI.openImage();
      if (result?.dataUrl) {
        const img = new window.Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image element"));
          img.src = result.dataUrl;
        });

        const image = readImg(img);
        const fileName = result.path.split(/[/\\]/).pop() || "Untitled";

        await loadImage(image, fileName);
      }
    } catch (error) {
      console.error("Failed to open image:", error);
    }
  };

  const handleSave = async () => {
    if (!previewCanvasRef.current) return;

    try {
      const canvas = previewCanvasRef.current;
      const dataUrl = canvas.toDataURL("image/png");

      await window.electronAPI.saveImage(dataUrl);
    } catch (error) {
      console.error("Failed to save image:", error);
    }
  };

  return (
    <div className="h-8 bg-slate-800 px-4 flex items-center text-xs text-slate-300">
      {/* File Operations */}
      <button
        type="button"
        onClick={handleOpen}
        className="text-slate-400 hover:text-slate-200 transition-colors mr-4"
      >
        Open
      </button>

      <button
        type="button"
        onClick={handleSave}
        disabled={!hasImage}
        className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mr-4"
      >
        Save
      </button>

      <span className="w-px h-4 bg-slate-600 mr-4"></span>

      {/* File Info */}
      {fileName && (
        <>
          <span className="text-slate-100 font-medium">{fileName}</span>
          <span className="mx-3 text-slate-500">|</span>
        </>
      )}
      {width && height && (
        <span>
          {width} × {height}
        </span>
      )}

      <span className="flex-1"></span>
      <span className="text-emerald-400">Ready</span>
    </div>
  );
};

export default BottomPanel;
