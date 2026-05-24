/**
 * Theme suggestion — one call that returns a coherent {font, background,
 * textColor} bundle for the current screenshot.
 *
 * Replaces the three separate palette / font / textColor suggesters: when a
 * designer thinks about appearance, those choices are coupled. A "playful
 * fitness app" doesn't get "Times New Roman + dark background + green text"
 * by asking each independently. Doing it in one call also halves the AI
 * latency and gives the user one ✨ button instead of three.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";
import { googleFonts } from "../../google-fonts";

const SYSTEM = `You are an expert App Store screenshot designer.
You pick a coherent visual theme — font, background, and text color — that
matches a brand's voice and gets people to download apps.

Rules:
- Pick exactly one fontFamily from the provided list. Match the brand voice (display fonts for energetic consumer apps; clean sans-serif for utility; serif for premium).
- Choose backgroundMode "solid" or "gradient" based on what suits the brand.
- All colors are 6-digit hex with a leading "#".
- textColor MUST contrast strongly against the background. White or near-white usually works for darker backgrounds; very dark colors for light backgrounds.
- When backgroundMode is "solid", set customGradient to null.
- When backgroundMode is "gradient", customGradient.from is the top color, customGradient.to is the bottom. Both stops should be visible.

Output ONLY this JSON object:
{
  "fontFamily": "exact font from the list",
  "backgroundMode": "solid" | "gradient",
  "backgroundColor": "#hhhhhh (always required as a fallback)",
  "customGradient": { "from": "#hhhhhh", "to": "#hhhhhh" } | null,
  "textColor": "#hhhhhh"
}`;

export interface ThemeRequest {
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
  currentFont?: string;
  currentBackground?: string;
}

export interface ThemeConfig {
  fontFamily: string;
  backgroundMode: "solid" | "gradient";
  backgroundColor: string;
  customGradient: { from: string; to: string } | null;
  textColor: string;
}

export interface ThemeResponse {
  theme: ThemeConfig | null;
  raw: string;
  durationMs: number;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const sanitizeHex = (s: unknown, fallback: string): string => {
  if (typeof s === "string" && HEX_RE.test(s.trim())) return s.trim();
  return fallback;
};

const parseTheme = (
  raw: string,
  allowedFonts: Set<string>,
): ThemeConfig | null => {
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
  const obj = payload as Partial<ThemeConfig> & {
    customGradient?: { from?: unknown; to?: unknown } | null;
  };

  const proposedFont =
    typeof obj.fontFamily === "string" ? obj.fontFamily.trim() : "";
  const matchedFont =
    [...allowedFonts].find(
      (a) => a.toLowerCase() === proposedFont.toLowerCase(),
    ) ?? "Inter";

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

  return {
    fontFamily: matchedFont,
    backgroundMode,
    backgroundColor,
    customGradient,
    textColor,
  };
};

export const generateTheme = async ({
  provider,
  model,
  brand,
  currentFont,
  currentBackground,
}: ThemeRequest): Promise<ThemeResponse> => {
  const brandContext = composeBrandContext(brand);
  const allowedFonts = new Set(googleFonts.map((f) => f.family));

  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    currentFont ? `Current font: ${currentFont}` : null,
    currentBackground ? `Current background: ${currentBackground}` : null,
    "",
    `Allowed fonts (pick one):`,
    googleFonts.map((f) => `- ${f.family} (${f.category})`).join("\n"),
    "",
    "Output the theme JSON object only.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 180_000,
    model,
  });

  return {
    theme: parseTheme(result.text, allowedFonts),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
