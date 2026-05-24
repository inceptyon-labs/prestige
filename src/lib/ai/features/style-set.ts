/**
 * Style-set: coherent visual variation across an entire listing.
 *
 * Given the current set of N panels (their headlines and any brand context),
 * the AI produces N varied-but-coherent themes that flow visually:
 *   - One shared font family (the listing feels like one design system)
 *   - Per-panel background that progresses (e.g. analogous-hue shift or
 *     complementary pair across the set)
 *   - Per-panel text color picked for contrast against that panel's bg
 *
 * Output is applied to all screenshots in-place; no new screenshots are
 * created and no copy is touched.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";
import { googleFonts } from "../../google-fonts";

const SYSTEM = `You are an expert App Store / Play Store listing designer.

The user already has N panels of copy. Your job is to design coherent but VARIED themes that flow visually across the set — so the panels feel like one design system, not N independent designs.

Rules:
- Pick ONE font family for the whole set.
- Each panel gets its own background (solid or gradient). Vary them so the set has visual rhythm:
  - Analogous palette (neighboring hues), OR
  - A hue shift from panel 1 → panel N, OR
  - A primary/secondary alternation
- Adjacent panels must NOT be identical. They should feel related — same saturation/lightness band, complementary or analogous hues.
- Per-panel textColor MUST have strong contrast against that panel's background.
- Stay on-brand. Match brand voice/audience colors and energy.
- Do NOT change the copy. You only return themes.

Output ONLY a JSON object matching this exact schema:
{
  "fontFamily": "exact font from allowed list",
  "panels": [
    {
      "backgroundMode": "solid" | "gradient",
      "backgroundColor": "#hhhhhh",
      "customGradient": { "from": "#hhhhhh", "to": "#hhhhhh" } | null,
      "textColor": "#hhhhhh with strong contrast against backgroundColor"
    },
    ... exactly N entries, in panel order ...
  ]
}

Rules for the shape:
- backgroundMode "gradient" requires customGradient with from + to; "solid" requires customGradient = null.
- All hex colors are 6-digit with a leading #.
- fontFamily MUST be exactly one of the allowed names.
- Return exactly N panels.
- No prose, no markdown fences. JSON only.`;

export interface StyleSetPanel {
  backgroundMode: "solid" | "gradient";
  backgroundColor: string;
  customGradient: { from: string; to: string } | null;
  textColor: string;
}

export interface StyleSetConfig {
  fontFamily: string;
  panels: StyleSetPanel[];
}

export interface StyleSetRequest {
  provider: AIProvider;
  model?: string;
  panelHeadlines: string[];
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
  };
  steer?: string;
}

export interface StyleSetResponse {
  config: StyleSetConfig | null;
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
  expectedPanels: number,
  allowedFonts: Set<string>,
): StyleSetConfig | null => {
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
  const obj = payload as {
    fontFamily?: unknown;
    panels?: unknown;
  };
  if (!Array.isArray(obj.panels)) return null;

  const proposedFont =
    typeof obj.fontFamily === "string" ? obj.fontFamily.trim() : "";
  const fontFamily =
    [...allowedFonts].find(
      (a) => a.toLowerCase() === proposedFont.toLowerCase(),
    ) ?? "Inter";

  const panels: StyleSetPanel[] = [];
  for (const entry of obj.panels) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Partial<StyleSetPanel> & {
      customGradient?: { from?: unknown; to?: unknown } | null;
    };
    const backgroundMode: "solid" | "gradient" =
      p.backgroundMode === "gradient" ? "gradient" : "solid";
    const backgroundColor = sanitizeHex(p.backgroundColor, "#000000");
    const textColor = sanitizeHex(p.textColor, "#ffffff");
    let customGradient: { from: string; to: string } | null = null;
    if (backgroundMode === "gradient" && p.customGradient) {
      const from = sanitizeHex(p.customGradient.from, "");
      const to = sanitizeHex(p.customGradient.to, "");
      if (from && to) customGradient = { from, to };
    }
    panels.push({
      backgroundMode,
      backgroundColor,
      customGradient,
      textColor,
    });
  }
  if (panels.length === 0) return null;
  // Pad if short, truncate if long. Better to do something than fail.
  while (panels.length < expectedPanels) {
    panels.push(panels[panels.length - 1]);
  }
  return {
    fontFamily,
    panels: panels.slice(0, expectedPanels),
  };
};

export const generateStyleSet = async ({
  provider,
  model,
  panelHeadlines,
  brand,
  steer,
}: StyleSetRequest): Promise<StyleSetResponse> => {
  const brandContext = composeBrandContext(brand);
  const allowedFonts = new Set(googleFonts.map((f) => f.family));
  const panelCount = panelHeadlines.length;

  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    `Current panels in order (do not change this copy):`,
    panelHeadlines.map((h, i) => `  ${i + 1}. ${h}`).join("\n"),
    steer?.trim() ? `User steer: ${steer.trim()}` : null,
    `Number of themes to return (N): ${panelCount}`,
    "",
    `Allowed fonts (pick one for the whole set):`,
    googleFonts.map((f) => `- ${f.family} (${f.category})`).join("\n"),
    "",
    `Return exactly ${panelCount} per-panel themes as one JSON object. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 240_000,
    model,
  });

  return {
    config: parseConfig(result.text, panelCount, allowedFonts),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
