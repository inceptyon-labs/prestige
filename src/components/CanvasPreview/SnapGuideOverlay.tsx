/**
 * Renders thin alignment lines on top of a screenshot card while a drag is
 * in progress. The lines are pointer-transparent so they never block clicks.
 *
 * Coordinates come in as percent values; horizontal guides are full-width
 * 1px lines at `top: y%`, vertical guides are full-height 1px lines at
 * `left: x%`.
 */

interface SnapGuideOverlayProps {
  /** Vertical guides — array of x percents (0..100) where to draw a v-line. */
  xGuides: number[];
  /** Horizontal guides — array of y percents (0..100) where to draw an h-line. */
  yGuides: number[];
}

const GUIDE_COLOR = "rgba(236, 72, 153, 0.9)"; // pink-500ish, high contrast on most bgs

export const SnapGuideOverlay = ({ xGuides, yGuides }: SnapGuideOverlayProps) => {
  if (xGuides.length === 0 && yGuides.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 9999 }}>
      {xGuides.map((x, i) => (
        <div
          key={`x-${i}-${x}`}
          className="absolute top-0 bottom-0"
          style={{
            left: `${x}%`,
            width: 1,
            background: GUIDE_COLOR,
            boxShadow: "0 0 2px rgba(236, 72, 153, 0.5)",
            transform: "translateX(-0.5px)",
          }}
        />
      ))}
      {yGuides.map((y, i) => (
        <div
          key={`y-${i}-${y}`}
          className="absolute left-0 right-0"
          style={{
            top: `${y}%`,
            height: 1,
            background: GUIDE_COLOR,
            boxShadow: "0 0 2px rgba(236, 72, 153, 0.5)",
            transform: "translateY(-0.5px)",
          }}
        />
      ))}
    </div>
  );
};
