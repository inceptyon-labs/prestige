/**
 * Generate a hero panel — headline + subheadline + an image-gen prompt
 * for the atmospheric background, all derived from brand context.
 *
 * A hero is the cover panel of an App Store listing: no devices, no UI
 * screenshots, just an evocative line and a mood-setting backdrop. This
 * module produces the three pieces in one AI call so they cohere as a
 * design unit. The image prompt is fed downstream into the same
 * brand-enriched image pipeline used by Style Set.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";
import { googleFonts } from "../../google-fonts";

const SYSTEM = `You design hero panels for App Store / Play Store listings.

A hero panel is the cover of a listing — no devices, no UI screenshots, no feature shots. Just one evocative line of copy on an atmospheric background. Its job is to make a stranger stop scrolling.

You will be given brand context (sometimes including a brand folder with design / voice notes). Your job is to produce ONE JSON object with four fields:

{
  "headline": "1-4 words, the brand's emotional promise. Punchy, memorable. Title Case or normal — match the brand voice.",
  "subheadline": "4-12 words, the differentiator or invitation. One sentence. Optional — return empty string if a single headline carries the moment better.",
  "imagePrompt": "8-30 words describing an atmospheric, mood-setting background image. Specific subject, medium, mood. NO text, NO UI, NO devices in the image. Should leave a clean area for the headline text to sit on.",
  "fontFamily": "ONE font family name picked from the allowed list. Match the brand voice."
}

Rules:
- Hero copy is NEVER a feature description. It sets a feeling.
- Image prompt should be visual and concrete. Not "modern app vibes" — instead "a softly-lit ceramic kitchen at golden hour, painterly".
- fontFamily MUST be exactly one of the supplied font names.
- No prose, no markdown fences. JSON only.`;

export interface HeroCardConfig {
  headline: string;
  subheadline: string;
  imagePrompt: string;
  fontFamily: string;
}

export interface HeroCardRequest {
  provider: AIProvider;
  model?: string;
  /** Optional angle / steer (e.g. "lean playful", "lean enterprise"). */
  angle?: string;
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
  };
}

export interface HeroCardResponse {
  config: HeroCardConfig | null;
  raw: string;
  durationMs: number;
}

const parseConfig = (
  raw: string,
  allowedFonts: Set<string>,
): HeroCardConfig | null => {
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
    })();
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Partial<HeroCardConfig>;
  const headline = typeof obj.headline === "string" ? obj.headline.trim() : "";
  const subheadline =
    typeof obj.subheadline === "string" ? obj.subheadline.trim() : "";
  const imagePrompt =
    typeof obj.imagePrompt === "string" ? obj.imagePrompt.trim() : "";
  if (!headline || !imagePrompt) return null;
  const proposedFont =
    typeof obj.fontFamily === "string" ? obj.fontFamily.trim() : "";
  const fontFamily =
    [...allowedFonts].find(
      (f) => f.toLowerCase() === proposedFont.toLowerCase(),
    ) ?? "Inter";
  return { headline, subheadline, imagePrompt, fontFamily };
};

export const generateHeroCard = async ({
  provider,
  model,
  angle,
  brand,
}: HeroCardRequest): Promise<HeroCardResponse> => {
  const brandContext = composeBrandContext(brand);
  const allowedFonts = new Set(googleFonts.map((f) => f.family));
  const userPrompt = [
    brandContext ? `Brand context (PRIMARY):\n${brandContext}` : null,
    angle?.trim() ? `Angle / steer: ${angle.trim()}` : null,
    "",
    `Allowed fonts:`,
    googleFonts.map((f) => `- ${f.family} (${f.category})`).join("\n"),
    "",
    "Return the hero JSON. JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 180_000,
    model,
  });
  return {
    config: parseConfig(result.text, allowedFonts),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
