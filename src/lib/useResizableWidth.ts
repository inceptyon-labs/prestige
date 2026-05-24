/**
 * Persisted resizable-width hook for sidebars.
 *
 * Tracks a pixel width in localStorage so the user's pick survives reloads,
 * with min/max clamping. Returns the current width plus a `startResize`
 * handler to wire into a drag handle's onMouseDown.
 *
 * `edge: "right"` means the drag handle lives on the element's right edge
 * (mouse moving right grows the element — typical left sidebar). `edge: "left"`
 * is the mirror (mouse moving right shrinks the element — typical right sidebar).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseResizableWidthOptions {
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
  edge: "left" | "right";
}

export const useResizableWidth = ({
  storageKey,
  defaultWidth,
  min,
  max,
  edge,
}: UseResizableWidthOptions) => {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultWidth;
    const n = Number(stored);
    if (!Number.isFinite(n)) return defaultWidth;
    return Math.max(min, Math.min(max, n));
  });
  const [isResizing, setIsResizing] = useState(false);

  // Refs hold mutable values needed inside the global mouse listeners
  // without forcing re-attachment on every render.
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const next =
        edge === "right" ? startWidthRef.current + delta : startWidthRef.current - delta;
      setWidth(Math.max(min, Math.min(max, next)));
    };
    const onUp = () => setIsResizing(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // While resizing, lock the body cursor and disable text selection so the
    // drag feels solid even if the cursor strays off the handle.
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isResizing, edge, min, max]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      setIsResizing(true);
    },
    [width],
  );

  return { width, isResizing, startResize };
};
