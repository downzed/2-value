import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useImageContext } from "../hooks/ImageContext";

const STORAGE_KEY = "image-editor-controls-position";
const DEFAULT_POSITION = { x: 20, y: 100 };

const FloatingControls: React.FC = () => {
  const {
    hasImage,
    blur,
    threshold,
    invert,
    setBlur,
    setThreshold,
    setInvert,
    resetControls,
  } = useImageContext();

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [isClosed, setIsClosed] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load position from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPosition(parsed);
      }
    } catch (e) {
      console.error("Failed to load position:", e);
    }
  }, []);

  // Reset visibility when image loads
  useEffect(() => {
    if (hasImage) {
      setIsClosed(false);
    }
  }, [hasImage]);

  // Save position to localStorage
  const savePosition = useCallback((pos: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch (e) {
      console.error("Failed to save position:", e);
    }
  }, []);

  // Mouse down - start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  };

  const positionRef = useRef(DEFAULT_POSITION);

  // Mouse move - update position
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPos = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      };
      positionRef.current = newPos;
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      savePosition(positionRef.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, savePosition]);

  const handleClose = () => {
    setIsClosed(true);
  };

  const handleToggle = () => {
    setIsClosed(false);
  };

  if (isClosed) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className="fixed bottom-24 left-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors z-50"
        title="Show Controls"
      >
        <svg
          className="w-5 h-5 text-slate-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>controls</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed bg-white rounded-lg shadow-xl border border-slate-200 z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? "grabbing" : "grab",
        minWidth: "200px",
      }}
    >
      {/* Header - drag handle */}
      {/** biome-ignore lint/a11y/noStaticElementInteractions: don't care right now */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3 py-2 border-b border-slate-100 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-400">⋮⋮</span>
          <span className="text-xs font-semibold text-slate-700">
            Adjustments
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>close</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-3">
        {/* Blur */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="blur-range"
            className="text-xs font-medium text-slate-600 w-14"
          >
            Blur
          </label>
          <input
            id="blur-range"
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={blur}
            onChange={(e) => setBlur(parseFloat(e.target.value))}
            disabled={!hasImage}
            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
          <span className="text-xs text-slate-500 w-6 text-right">{blur}</span>
        </div>

        {/* Threshold */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="thresh-range"
            className="text-xs font-medium text-slate-600 w-14"
          >
            Thresh
          </label>
          <input
            type="range"
            id="thresh-range"
            min={0}
            max={255}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            disabled={!hasImage}
            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
          <span className="text-xs text-slate-500 w-8 text-right">
            {threshold}
          </span>
        </div>

        {/* Invert */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={invert}
              onChange={(e) => setInvert(e.target.checked)}
              disabled={!hasImage}
              className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
            />
            <span className="text-xs font-medium text-slate-600">Invert</span>
          </label>
          <button
            type="button"
            onClick={resetControls}
            disabled={!hasImage}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingControls;
