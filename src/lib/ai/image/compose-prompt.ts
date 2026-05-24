/**
 * Enrich a short user image prompt with brand + listing context before
 * sending it to the image-gen API. The user types "watercolor vine
 * leaves"; the image model receives that plus palette, voice, audience,
 * font, and kind-specific composition notes — so the result actually
 * matches the rest of the listing.
 *
 * Programmatic, not AI — we already know the brand context locally; no
 * point spending a text-API round-trip just to format it. The AI rewrite
 * is a separate, optional layer (see ../features/enrich-image-prompt.ts).
 */

import type { BrandFolderContents } from "../brand";
import type { Screenshot } from "../../../types";

export type ImagePromptPurpose =
  | "spanning-background"
  | "panel-background"
  | "overlay-accent"
  | "spanning-overlay";

export interface ComposeImagePromptInput {
  userPrompt: string;
  purpose: ImagePromptPurpose;
  panels: Screenshot[];
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
  };
  /** When set on spanning modes, override the auto-derived panel count. */
  spanPanelCount?: number;
}

/**
 * Pull the brand-folder text most likely to describe visual style. Keeps
 * the prompt size bounded — we only include files mentioning visual
 * keywords ("color", "palette", "style", "logo", "brand", "design").
 */
const VISUAL_KEYWORDS_RE =
  /\b(color|palette|style|logo|brand|design|aesthetic|typography|illustration|tone|mood)\b/i;

const extractVisualHints = (
  folder: BrandFolderContents | null | undefined,
): string => {
  if (!folder) return "";
  const chunks: string[] = [];
  for (const [name, contents] of Object.entries(folder.files)) {
    if (!VISUAL_KEYWORDS_RE.test(contents)) continue;
    // Pull lines mentioning visual keywords + a few lines of context.
    const lines = contents.split("\n");
    const picked: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (VISUAL_KEYWORDS_RE.test(lines[i])) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 3);
        for (let j = start; j < end; j++) {
          if (!picked.includes(lines[j])) picked.push(lines[j]);
        }
      }
    }
    if (picked.length > 0) {
      chunks.push(`From ${name}:\n${picked.join("\n").slice(0, 800)}`);
    }
  }
  return chunks.join("\n\n");
};

/**
 * Derive a palette from the current screenshots: deduped background +
 * text colors. Image models respond well to explicit hex palettes.
 */
const derivePalette = (panels: Screenshot[]): string[] => {
  const palette = new Set<string>();
  for (const s of panels) {
    if (s.backgroundColor) palette.add(s.backgroundColor);
    if (s.textColor) palette.add(s.textColor);
    if (s.customGradient?.from) palette.add(s.customGradient.from);
    if (s.customGradient?.to) palette.add(s.customGradient.to);
  }
  return [...palette].slice(0, 8);
};

const deriveFonts = (panels: Screenshot[]): string[] => {
  const fonts = new Set<string>();
  for (const s of panels) {
    if (s.fontFamily) fonts.add(s.fontFamily);
  }
  return [...fonts].slice(0, 3);
};

const compositionGuide = (
  purpose: ImagePromptPurpose,
  spanPanelCount?: number,
): string => {
  switch (purpose) {
    case "spanning-background":
      return [
        `COMPOSITION: One panoramic scene that reads left-to-right.`,
        `Will be sliced into ${spanPanelCount ?? "N"} equal vertical strips and placed across adjacent screenshots — keep important content distributed across the width, not concentrated in the center.`,
        `No text. No UI. No device frames. Atmospheric, suitable as a full-bleed background.`,
      ].join("\n");
    case "spanning-overlay":
      return [
        `COMPOSITION: A wide decorative band that reads left-to-right.`,
        `Will be sliced into ${spanPanelCount ?? "N"} pieces and placed as a continuous strip across adjacent screenshots — keep the visual rhythm consistent across the width.`,
        `The middle vertical zone of the image is what will appear; edges are cropped.`,
        `No text. Translucent / soft / decorative — not a competing focal point.`,
      ].join("\n");
    case "panel-background":
      return [
        `COMPOSITION: A single screenshot background, portrait orientation in spirit (will be center-cropped to fit).`,
        `Keep visual interest balanced; allow a clean area in the middle for headline text and a device mockup.`,
        `No text. No UI. No device frames.`,
      ].join("\n");
    case "overlay-accent":
      return [
        `COMPOSITION: A small isolated illustration / icon, centered on a transparent or cleanly cuttable background.`,
        `Minimal, single subject, no scene. Single-color or limited-palette flat or line illustration.`,
        `No text. Not a full scene.`,
      ].join("\n");
  }
};

/**
 * Build the full enriched image prompt. Order matters — image models
 * weight earlier tokens more, so we lead with the SUBJECT (user's idea)
 * and then layer style + composition constraints.
 */
export const composeEnrichedImagePrompt = ({
  userPrompt,
  purpose,
  panels,
  brand,
  spanPanelCount,
}: ComposeImagePromptInput): string => {
  const palette = derivePalette(panels);
  const fonts = deriveFonts(panels);
  const visualHints = extractVisualHints(brand.folder);

  const brandLines: string[] = [];
  if (brand.brandName?.trim())
    brandLines.push(`App: ${brand.brandName.trim()}`);
  if (brand.audience?.trim())
    brandLines.push(`Audience: ${brand.audience.trim()}`);
  if (brand.voice?.trim())
    brandLines.push(`Brand voice / tone: ${brand.voice.trim()}`);
  if (brand.keyFeature?.trim())
    brandLines.push(`Key feature: ${brand.keyFeature.trim()}`);

  const styleLines: string[] = [];
  if (palette.length > 0) {
    styleLines.push(
      `Palette already in use across this listing (match or harmonize): ${palette.join(", ")}`,
    );
  }
  if (fonts.length > 0) {
    styleLines.push(
      `Typography on the rest of the listing: ${fonts.join(", ")} — pick illustration character that complements it.`,
    );
  }

  const sections = [
    `SUBJECT: ${userPrompt.trim()}`,
    "",
    brandLines.length > 0 ? `BRAND CONTEXT:\n${brandLines.join("\n")}` : null,
    styleLines.length > 0 ? `VISUAL CONSISTENCY:\n${styleLines.join("\n")}` : null,
    visualHints
      ? `BRAND STYLE NOTES (from brand folder):\n${visualHints}`
      : null,
    compositionGuide(purpose, spanPanelCount),
  ]
    .filter(Boolean)
    .join("\n\n");

  return sections;
};
