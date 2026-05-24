/**
 * Layout suggestion — AI picks one of the named position presets that best
 * matches the brand voice + screen content.
 *
 * Why pick a preset (rather than free-form scale/rotation/etc.):
 *   - Presets encode the human designer's intent ("Bleed Bottom" = bold,
 *     scrollable; "Centered" = clean, safe; "Tilt Right" = energetic).
 *   - AI is much better at picking from a labelled small set than tuning
 *     numeric sliders.
 *   - Applying a preset is a single state change the user can undo easily.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";

export const LAYOUT_PRESET_IDS = [
  "centered",
  "bleed-bottom",
  "bleed-top",
  "float-center",
  "tilt-left",
  "tilt-right",
  "perspective",
  "float-bottom",
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

const PRESET_DESCRIPTIONS: Record<LayoutPresetId, string> = {
  centered: "device centered, no tilt — clean, safe, universal",
  "bleed-bottom": "device bleeds off the bottom edge — bold, scrollable feel",
  "bleed-top": "device bleeds off the top edge — content-first marketing",
  "float-center": "smaller device floating in the middle — minimal, premium",
  "tilt-left": "device rotated 15° left — playful, energetic",
  "tilt-right": "device rotated 15° right — playful, energetic",
  perspective: "3D perspective with rotateY -20° — modern, immersive",
  "float-bottom": "smaller device near the bottom — text-led storytelling",
};

const SYSTEM = `You are an expert App Store screenshot designer.
You pick one named layout preset that best matches the brand voice and the screen content.

Rules:
- Pick exactly one of the layout IDs provided.
- Match the brand voice: tilted/3D for energetic consumer apps, centered/floating for clean utility/enterprise.
- If the screen description suggests a list-heavy / scrollable interface, prefer "bleed-bottom" or "bleed-top" so the content feels rich.
- Output ONLY a JSON object: {"layout":"<one of the IDs>"}.
- No prose, no markdown fences.`;

export interface LayoutRequest {
  provider: AIProvider;
  model?: string;
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
    screenDescription?: string;
  };
  currentLayout?: string;
}

export interface LayoutResponse {
  layout: LayoutPresetId | null;
  raw: string;
  durationMs: number;
}

const parseLayout = (raw: string): LayoutPresetId | null => {
  const trimmed = raw.trim();
  const tryParse = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };
  const payload: unknown =
    tryParse(trimmed) ??
    (() => {
      const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      return fence ? tryParse(fence[1].trim()) : null;
    })() ??
    null;

  let candidate = "";
  if (payload && typeof payload === "object" && "layout" in payload) {
    const v = (payload as { layout?: unknown }).layout;
    if (typeof v === "string") candidate = v.trim();
  } else if (typeof payload === "string") {
    candidate = payload.trim();
  } else {
    // Last-ditch: look for any preset id mentioned in the raw text.
    const match = LAYOUT_PRESET_IDS.find((id) =>
      trimmed.toLowerCase().includes(id),
    );
    if (match) return match;
  }

  return (LAYOUT_PRESET_IDS as readonly string[]).includes(candidate)
    ? (candidate as LayoutPresetId)
    : null;
};

export const generateLayout = async ({
  provider,
  model,
  brand,
  currentLayout,
}: LayoutRequest): Promise<LayoutResponse> => {
  const brandContext = composeBrandContext(brand);

  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    currentLayout ? `Current layout: ${currentLayout}` : null,
    "",
    "Available layout presets:",
    ...LAYOUT_PRESET_IDS.map(
      (id) => `- ${id}: ${PRESET_DESCRIPTIONS[id]}`,
    ),
    "",
    `Pick one layout. Output {"layout":"<id>"} only.`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 180_000,
    model,
  });

  return {
    layout: parseLayout(result.text),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
