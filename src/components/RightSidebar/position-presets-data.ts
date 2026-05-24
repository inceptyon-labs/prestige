/**
 * Position preset settings — shared between the PositionPresets UI buttons
 * and the AI Layout suggestion flow. The JSX icons + labels stay in
 * PositionPresets.tsx; only the apply-able settings live here.
 */

import type { DeviceStyle } from "../../types";

export interface PresetSettings {
  scale: number;
  y: number;
  rotation: number;
  style: DeviceStyle;
  rotateY?: number;
  rotateX?: number;
}

export const POSITION_PRESET_SETTINGS: Record<string, PresetSettings> = {
  centered: { scale: 65, y: 35, rotation: 0, style: "flat" },
  "bleed-bottom": { scale: 70, y: 45, rotation: 0, style: "flat" },
  "bleed-top": { scale: 70, y: 15, rotation: 0, style: "flat" },
  "float-center": { scale: 55, y: 30, rotation: 0, style: "flat" },
  "tilt-left": { scale: 60, y: 35, rotation: -15, style: "flat" },
  "tilt-right": { scale: 60, y: 35, rotation: 15, style: "flat" },
  perspective: {
    scale: 60,
    y: 35,
    rotation: 0,
    style: "3d",
    rotateY: -20,
    rotateX: 5,
  },
  "float-bottom": { scale: 50, y: 50, rotation: 0, style: "flat" },
};
