/**
 * CanvasPreview Component
 *
 * Main canvas area displaying all screenshots with interactive editing capabilities.
 * Supports drag-and-drop positioning, element selection, and screenshot management.
 *
 * Features:
 * - Horizontal scrolling screenshot gallery
 * - Drag-to-position text and overlay elements
 * - Add/remove screenshots
 * - Responsive preview scaling
 */

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import { getRenderableDevicesForScreenshot } from "../../lib/device-overflow";
import { Toolbar } from "./Toolbar";
import { ScreenshotCard } from "./ScreenshotCard";
import { useResizeObserver } from "./useResizeObserver";

/**
 * CanvasPreview - Main screenshot editing canvas
 *
 * Displays all screenshots in a horizontal scrollable gallery.
 * The active screenshot can be edited by dragging elements.
 *
 * @example
 * <CanvasPreview />
 */
export const CanvasPreview = () => {
  const {
    screenshots,
    activeScreenshotId,
    setActiveScreenshotId,
    setSelectedElement,
    removeScreenshot,
    handleElementMouseDown,
    handleElementMouseUp,
    getBackgroundStyle,
    addScreenshot,
    previewRef,
    canvasContainerRef,
    selectedElement,
    headlineFontSize,
    subheadlineFontSize,
    setPreviewDimensions,
    exportSize,
    dragGuides,
  } = useEditor();

  // Track preview dimensions for export scaling
  useResizeObserver({
    elementRef: previewRef,
    onResize: setPreviewDimensions,
    deps: [activeScreenshotId],
  });

  const activeIndex = screenshots.findIndex((s) => s.id === activeScreenshotId);

  const goToIndex = (next: number) => {
    if (next < 0 || next >= screenshots.length) return;
    const target = screenshots[next];
    setActiveScreenshotId(target.id);
    setSelectedElement(null);
    // Scroll the corresponding card into view. The cards live in the
    // flex track inside the canvas container; their order matches the
    // screenshots array.
    requestAnimationFrame(() => {
      const track = canvasContainerRef.current?.firstElementChild;
      const card = track?.children[next] as HTMLElement | undefined;
      card?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    });
  };

  // Sync `activeScreenshotId` to whichever card is centered in the canvas
  // viewport, so the prev/next arrows reflect what the user is actually
  // looking at rather than the abstract "editing cursor". Without this,
  // scrolling left/right (or having all panels fit on-screen at once) leaves
  // active stuck on the original screenshot and the arrows get confused.
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const updateActiveFromScroll = () => {
      const track = container.firstElementChild;
      if (!track) return;
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;
      let bestIndex = -1;
      let bestDistance = Infinity;
      for (let i = 0; i < track.children.length; i++) {
        const child = track.children[i] as HTMLElement;
        const r = child.getBoundingClientRect();
        const childCenter = r.left + r.width / 2;
        const distance = Math.abs(childCenter - centerX);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      if (bestIndex >= 0 && screenshots[bestIndex]) {
        const id = screenshots[bestIndex].id;
        if (id !== activeScreenshotId) {
          setActiveScreenshotId(id);
        }
      }
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateActiveFromScroll();
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [activeScreenshotId, screenshots, setActiveScreenshotId, canvasContainerRef]);

  // Arrow keys for prev/next, but only when the canvas is the focus context
  // (i.e. no text input has focus). Skip during text editing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && (e.metaKey || e.altKey)) {
        e.preventDefault();
        goToIndex(activeIndex - 1);
      } else if (e.key === "ArrowRight" && (e.metaKey || e.altKey)) {
        e.preventDefault();
        goToIndex(activeIndex + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, screenshots]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Toolbar
        onAddScreenshot={addScreenshot}
        screenshotCount={screenshots.length}
      />

      {/* Preview area with horizontal scroll */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={canvasContainerRef}
          className="absolute inset-0 overflow-x-auto overflow-y-hidden bg-[#0a0a0a] p-6"
        >
          <div className="flex gap-1 h-full min-w-max">
          {screenshots.map((screenshot, index) => {
            const renderableDevices = getRenderableDevicesForScreenshot(
              screenshots,
              index,
            );

            return (
              <ScreenshotCard
                key={screenshot.id}
                screenshot={screenshot}
                renderableDevices={renderableDevices}
                isActive={activeScreenshotId === screenshot.id}
                canRemove={screenshots.length > 1}
                selectedElement={selectedElement}
                exportSize={exportSize}
                headlineFontSize={headlineFontSize}
                subheadlineFontSize={subheadlineFontSize}
                previewRef={previewRef}
                getBackgroundStyle={getBackgroundStyle}
                onSelect={() => {
                  if (activeScreenshotId !== screenshot.id) {
                    setActiveScreenshotId(screenshot.id);
                    setSelectedElement(null);
                  }
                }}
                onRemove={() => removeScreenshot(screenshot.id)}
                onDeselect={() => setSelectedElement(null)}
                onElementMouseDown={handleElementMouseDown}
                onElementMouseUp={handleElementMouseUp}
                guides={dragGuides[screenshot.id]}
              />
            );
          })}
          </div>
        </div>

        {/* Prev/next navigation — only when there's more than one screenshot.
            High z-index + isolate creates a fresh stacking context so the
            3D-transformed devices in the canvas can't render above. */}
        {screenshots.length > 1 && (
          <div className="pointer-events-none absolute inset-0 z-30 isolate">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToIndex(activeIndex - 1);
              }}
              disabled={activeIndex <= 0}
              title="Previous screenshot (⌘← / ⌥←)"
              className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/70 hover:bg-black border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full shadow-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToIndex(activeIndex + 1);
              }}
              disabled={activeIndex >= screenshots.length - 1}
              title="Next screenshot (⌘→ / ⌥→)"
              className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/70 hover:bg-black border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full shadow-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/70 border border-white/20 text-white text-xs rounded-full font-medium shadow-lg">
              {activeIndex + 1} / {screenshots.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
