/**
 * Thin vertical drag bar to resize a sidebar.
 *
 * Renders a 4px hit area absolute-positioned on one edge of the parent
 * (the parent must be `relative`). The visible affordance is the same width
 * but only highlights on hover/active so it doesn't visually compete with
 * the sidebar's own border.
 */

interface ResizeHandleProps {
  /** Which edge of the parent this handle sits on. */
  side: "left" | "right";
  /** Drag start callback (typically from useResizableWidth). */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Render with the active highlight (drag in progress). */
  isActive?: boolean;
}

export const ResizeHandle = ({
  side,
  onMouseDown,
  isActive,
}: ResizeHandleProps) => {
  const sideClass = side === "left" ? "left-0" : "right-0";
  return (
    <div
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize"
      className={`absolute top-0 bottom-0 ${sideClass} w-1.5 cursor-col-resize z-50 group`}
      style={{ transform: side === "left" ? "translateX(-50%)" : "translateX(50%)" }}
    >
      <div
        className={`h-full w-px mx-auto transition-colors ${
          isActive
            ? "bg-violet-500"
            : "bg-transparent group-hover:bg-violet-500/60"
        }`}
      />
    </div>
  );
};
