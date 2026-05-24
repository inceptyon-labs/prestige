/**
 * Generate-from-brand feature.
 *
 * Takes a one-line "idea" (e.g. "the home dashboard showing daily streaks")
 * plus the project's brand context and asks the AI to scaffold a complete
 * screenshot: headline, subheadline, background, text color, font.
 *
 * The output is fed straight into a new Screenshot when the user accepts.
 * Position / device choices stay manual; we only generate the marketing
 * layer the AI is good at.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";
import { googleFonts } from "../../google-fonts";

const SYSTEM = `You are an expert App Store screenshot designer.
You scaffold a complete screenshot from a one-line idea and a brand context.

You must output ONLY a JSON object matching this schema:
{
  "headline": "string, 3-7 words, punchy, benefit-driven",
  "subheadline": "string, 6-14 words, supporting detail",
  "backgroundMode": "solid" | "gradient",
  "backgroundColor": "#hhhhhh (used when backgroundMode is solid; still required as a fallback)",
  "customGradient": { "from": "#hhhhhh", "to": "#hhhhhh" } | null,
  "textColor": "#hhhhhh that has strong contrast against the background",
  "fontFamily": "exact font family name from the list provided"
}

Rules:
- All colors are 6-digit hex with a leading "#".
- Stay on-brand. Match the voice and audience exactly.
- Pick a backgroundMode that suits the brand: "gradient" for energetic / consumer apps, "solid" for clean / utility / enterprise.
- When backgroundMode is "solid", set customGradient to null.
- The fontFamily MUST be exactly one of the names provided. No invented fonts.
- No prose, no markdown fences. JSON only.`;

export interface FullScreenshotRequest {
  provider: AIProvider;
  model?: string;
  idea: string;
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
    screenDescription?: string;
  };
}

export interface FullScreenshotConfig {
  headline: string;
  subheadline: string;
  backgroundMode: "solid" | "gradient";
  backgroundColor: string;
  customGradient: { from: string; to: string } | null;
  textColor: string;
  fontFamily: string;
}

export interface FullScreenshotResponse {
  config: FullScreenshotConfig | null;
  raw: string;
  durationMs: number;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const sanitizeHex = (s: unknown, fallback: string): string => {
  if (typeof s === "string" && HEX_RE.test(s.trim())) return s.trim();
  return fallback;
};

const parseConfig = (
  raw: string,
  allowedFonts: Set<string>,
): FullScreenshotConfig | null => {
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
  const obj = payload as Partial<FullScreenshotConfig> & {
    customGradient?: { from?: unknown; to?: unknown } | null;
  };

  const headline = typeof obj.headline === "string" ? obj.headline.trim() : "";
  const subheadline =
    typeof obj.subheadline === "string" ? obj.subheadline.trim() : "";
  if (!headline) return null;

  const backgroundMode: "solid" | "gradient" =
    obj.backgroundMode === "gradient" ? "gradient" : "solid";
  const backgroundColor = sanitizeHex(obj.backgroundColor, "#000000");
  const textColor = sanitizeHex(obj.textColor, "#ffffff");

  let customGradient: { from: string; to: string } | null = null;
  if (backgroundMode === "gradient" && obj.customGradient) {
    const from = sanitizeHex(obj.customGradient.from, "");
    const to = sanitizeHex(obj.customGradient.to, "");
    if (from && to) customGradient = { from, to };
  }

  // Font: match case-insensitively against allowed list; fall back to Inter.
  const proposed =
    typeof obj.fontFamily === "string" ? obj.fontFamily.trim() : "";
  const matched =
    [...allowedFonts].find(
      (a) => a.toLowerCase() === proposed.toLowerCase(),
    ) ?? "Inter";

  return {
    headline,
    subheadline,
    backgroundMode,
    backgroundColor,
    customGradient,
    textColor,
    fontFamily: matched,
  };
};

export const generateFullScreenshot = async ({
  provider,
  model,
  idea,
  brand,
}: FullScreenshotRequest): Promise<FullScreenshotResponse> => {
  const brandContext = composeBrandContext(brand);
  const allowedFonts = new Set(googleFonts.map((f) => f.family));

  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    `Screenshot idea: ${idea}`,
    "",
    `Allowed fonts (pick one):`,
    googleFonts.map((f) => `- ${f.family} (${f.category})`).join("\n"),
    "",
    "Generate the screenshot config JSON only.",
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
