import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useDraggablePanel } from "../../../src/renderer/hooks/useDraggablePanel";

describe("useDraggablePanel", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => mockStorage[key] ?? null);
    vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      mockStorage[key] = value;
    });
    vi.spyOn(localStorage, "removeItem").mockImplementation((key: string) => {
      delete mockStorage[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default position", () => {
    const panelRef = {
      current: null,
    } as unknown as React.RefObject<HTMLDivElement>;
    const { result } = renderHook(() =>
      useDraggablePanel({
        storageKey: "test-key",
        defaultPosition: { x: 20, y: 30 },
        panelRef,
      }),
    );

    expect(result.current.position).toEqual({ x: 20, y: 30 });
  });

  it("should return isDragging as false initially", () => {
    const panelRef = {
      current: null,
    } as unknown as React.RefObject<HTMLDivElement>;
    const { result } = renderHook(() =>
      useDraggablePanel({
        storageKey: "test-key",
        defaultPosition: { x: 20, y: 30 },
        panelRef,
      }),
    );

    expect(result.current.isDragging).toBe(false);
  });

  it("should provide handleMouseDown function", () => {
    const panelRef = {
      current: null,
    } as unknown as React.RefObject<HTMLDivElement>;
    const { result } = renderHook(() =>
      useDraggablePanel({
        storageKey: "test-key",
        defaultPosition: { x: 20, y: 30 },
        panelRef,
      }),
    );

    expect(typeof result.current.handleMouseDown).toBe("function");
  });
});
