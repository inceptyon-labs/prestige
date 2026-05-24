/**
 * Drag-time snap-to-guides logic.
 *
 * When the user drags a text/device/image element, we want to:
 *   - Show alignment guides for canvas centers/edges and other elements
 *   - Show matching guides on the *adjacent* screenshot cards so the user can
 *     line up positions across panels
 *   - Snap the dragged element when it lands within a small percent threshold
 *
 * All coordinates here are screenshot-local percent values (0..100). Since
 * every card shares the same aspect ratio and renders at the same on-screen
 * size, a constant percent threshold feels consistent across panels.
 */

import type { Screenshot, SelectedElement } from "../../types";

/** Match threshold in percent of card dimension. ~1.5% feels tight but forgiving. */
export const SNAP_THRESHOLD_PERCENT = 1.5;
/** Tolerance for grouping equivalent target values when rendering guides. */
const TARGET_GROUP_EPSILON = 0.25;

export type DragGuides = Record<string, { x: number[]; y: number[] }>;

type SnapTarget = {
  value: number;
  screenshotId: string;
};

type SnapAxisResult = {
  snappedValue: number;
  matches: SnapTarget[];
};

const sameSelection = (
  a: SelectedElement,
  type: SelectedElement["type"],
  screenshotId: string,
  id?: string,
): boolean =>
  a.type === type &&
  a.screenshotId === screenshotId &&
  (a.id ?? undefined) === (id ?? undefined);

/**
 * Collect snap targets across the source screenshot and its immediate
 * neighbors (previous + next). Canvas guides (0/50/100) only originate from
 * the source — neighbors don't push canvas guides, since the user is trying
 * to align *to neighbor element positions*, not their own canvas edges.
 */
export const buildSnapTargets = (
  screenshots: Screenshot[],
  activeIndex: number,
  dragging: SelectedElement,
): { x: SnapTarget[]; y: SnapTarget[] } => {
  const x: SnapTarget[] = [];
  const y: SnapTarget[] = [];

  const source = screenshots[activeIndex];
  if (!source) return { x, y };

  // Canvas guides — only from the source card so neighbors don't pollute.
  for (const v of [0, 50, 100]) {
    x.push({ value: v, screenshotId: source.id });
    y.push({ value: v, screenshotId: source.id });
  }

  const neighborIndexes = [activeIndex - 1, activeIndex, activeIndex + 1].filter(
    (i) => i >= 0 && i < screenshots.length,
  );

  for (const idx of neighborIndexes) {
    const s = screenshots[idx];
    const isSource = idx === activeIndex;

    // Headline
    if (!(isSource && sameSelection(dragging, "headline", s.id))) {
      x.push({ value: s.headlineX, screenshotId: s.id });
      y.push({ value: s.headlineY, screenshotId: s.id });
    }
    // Subheadline
    if (!(isSource && sameSelection(dragging, "subheadline", s.id))) {
      x.push({ value: s.subheadlineX, screenshotId: s.id });
      y.push({ value: s.subheadlineY, screenshotId: s.id });
    }
    // Devices — push center x and top y
    for (const d of s.devices) {
      if (isSource && sameSelection(dragging, "device", s.id, d.id)) continue;
      x.push({ value: d.x, screenshotId: s.id });
      y.push({ value: d.y, screenshotId: s.id });
    }
    // Overlay images — center x/y plus edges
    for (const img of s.overlayImages) {
      if (isSource && sameSelection(dragging, "image", s.id, img.id)) continue;
      x.push({ value: img.x, screenshotId: s.id });
      x.push({ value: img.x - img.width / 2, screenshotId: s.id });
      x.push({ value: img.x + img.width / 2, screenshotId: s.id });
      y.push({ value: img.y, screenshotId: s.id });
      y.push({ value: img.y - img.height / 2, screenshotId: s.id });
      y.push({ value: img.y + img.height / 2, screenshotId: s.id });
    }
  }

  return { x, y };
};

/**
 * Find the nearest snap target on one axis. Returns null if no target is
 * within threshold.
 */
const snapAxis = (
  value: number,
  targets: SnapTarget[],
  threshold: number,
): SnapAxisResult | null => {
  let best: { target: SnapTarget; dist: number } | null = null;
  for (const t of targets) {
    const dist = Math.abs(value - t.value);
    if (dist <= threshold && (best === null || dist < best.dist)) {
      best = { target: t, dist };
    }
  }
  if (!best) return null;
  const matches = targets.filter(
    (t) => Math.abs(t.value - best!.target.value) < TARGET_GROUP_EPSILON,
  );
  return { snappedValue: best.target.value, matches };
};

/**
 * Compute snapped position + guides for a drag in progress.
 *
 * @param valueX/valueY  The dragged element's current center x and "y anchor"
 *                       in percent. (For text/device, y is the top edge; for
 *                       overlays, y is the center — we snap raw value to raw
 *                       value, which means same-type alignment is exact and
 *                       cross-type alignment matches the underlying numbers.)
 * @returns snapped coords and a per-screenshot guide map ready to render.
 */
export const computeSnap = (
  screenshots: Screenshot[],
  activeIndex: number,
  dragging: SelectedElement,
  valueX: number,
  valueY: number,
  threshold: number = SNAP_THRESHOLD_PERCENT,
): { x: number; y: number; guides: DragGuides } => {
  const { x: xTargets, y: yTargets } = buildSnapTargets(
    screenshots,
    activeIndex,
    dragging,
  );

  const xSnap = snapAxis(valueX, xTargets, threshold);
  const ySnap = snapAxis(valueY, yTargets, threshold);

  const guides: DragGuides = {};
  const ensure = (id: string) => {
    if (!guides[id]) guides[id] = { x: [], y: [] };
    return guides[id];
  };

  if (xSnap) {
    for (const m of xSnap.matches) ensure(m.screenshotId).x.push(xSnap.snappedValue);
    // Always echo the snapped guide on the source card so the user sees the
    // line they snapped to, even if the match came from a neighbor.
    const sourceId = screenshots[activeIndex]?.id;
    if (sourceId && !xSnap.matches.some((m) => m.screenshotId === sourceId)) {
      ensure(sourceId).x.push(xSnap.snappedValue);
    }
  }
  if (ySnap) {
    for (const m of ySnap.matches) ensure(m.screenshotId).y.push(ySnap.snappedValue);
    const sourceId = screenshots[activeIndex]?.id;
    if (sourceId && !ySnap.matches.some((m) => m.screenshotId === sourceId)) {
      ensure(sourceId).y.push(ySnap.snappedValue);
    }
  }

  return {
    x: xSnap ? xSnap.snappedValue : valueX,
    y: ySnap ? ySnap.snappedValue : valueY,
    guides,
  };
};
