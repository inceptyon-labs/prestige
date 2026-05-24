/**
 * Batch listing generation.
 *
 * Generates a coherent N-panel App Store listing in one AI call:
 *   - One shared theme (background, fonts, palette) so the panels feel like a set
 *   - Per-panel headline / subheadline that tell a sequenced story
 *     (hero → features → social proof / CTA)
 *
 * Output is applied as either a replacement for the current project's
 * screenshots or appended onto them. The device choice carries over from the
 * user's current selection; we only generate the marketing layer.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";
import { googleFonts } from "../../google-fonts";

export type PanelRole = "hero" | "feature" | "social-proof" | "cta" | "detail";

const PANEL_ROLES: ReadonlySet<PanelRole> = new Set([
  "hero",
  "feature",
  "social-proof",
  "cta",
  "detail",
]);

const SYSTEM = `You are an expert App Store / Play Store listing designer.
Generate a coherent set of N marketing screenshots that share one visual design and tell a sequenced story.

PRIMARY SOURCE OF TRUTH: the brand context block (brand name, audience, voice, key feature, and ESPECIALLY any brand-folder files like brand.md / README.md / design.md). Read it carefully. Match its terminology, ranking of features, and tone precisely. The brand folder represents what the app actually IS; do not invent features that aren't in it.

Optional 'idea' field: a one-line angle / focus hint from the user. If present, treat it as a steer (e.g. "lean into the social side"). If absent, design the listing purely from the brand context.

Rules:
- All N panels share the SAME theme (background, gradient, text color, font). Variation lives only in the copy.
- Panel 1 is the hero: the strongest benefit from the brand context, broad-audience headline. Subheadline orients the user.
- Middle panels each spotlight a different REAL feature from the brand context. Do not repeat features. Do not invent new ones.
- Final panel is a CTA, social-proof, or aspirational close that fits the brand voice.
- Headlines: 3-7 words, punchy, benefit-driven. Subheadlines: 6-14 words, supporting detail.
- Stay strictly on-brand. Match the supplied voice/audience exactly.

Output ONLY a JSON object matching this exact schema:
{
  "theme": {
    "backgroundMode": "solid" | "gradient",
    "backgroundColor": "#hhhhhh",
    "customGradient": { "from": "#hhhhhh", "to": "#hhhhhh" } | null,
    "textColor": "#hhhhhh with strong contrast against the background",
    "fontFamily": "exact font family from the supplied list"
  },
  "panels": [
    { "role": "hero" | "feature" | "social-proof" | "cta" | "detail", "headline": "...", "subheadline": "..." },
    ... exactly N entries total ...
  ]
}

Rules for the shape:
- backgroundMode "gradient" requires customGradient with from + to; backgroundMode "solid" requires customGradient = null.
- All hex colors are 6-digit with a leading #.
- fontFamily MUST be exactly one of the allowed names. No invented fonts.
- Return exactly N panels.
- No prose, no markdown fences. JSON only.`;

export interface ListingTheme {
  backgroundMode: "solid" | "gradient";
  backgroundColor: string;
  customGradient: { from: string; to: string } | null;
  textColor: string;
  fontFamily: string;
}

export interface ListingPanel {
  role: PanelRole;
  headline: string;
  subheadline: string;
}

export interface ListingConfig {
  theme: ListingTheme;
  panels: ListingPanel[];
}

export interface ListingRequest {
  provider: AIProvider;
  model?: string;
  idea: string;
  panelCount: number;
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
    screenDescription?: string;
  };
}

export interface ListingResponse {
  config: ListingConfig | null;
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
): ListingConfig | null => {
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
    theme?: Partial<ListingTheme> & {
      customGradient?: { from?: unknown; to?: unknown } | null;
    };
    panels?: unknown;
  };

  if (!obj.theme || !Array.isArray(obj.panels)) return null;

  const backgroundMode: "solid" | "gradient" =
    obj.theme.backgroundMode === "gradient" ? "gradient" : "solid";
  const backgroundColor = sanitizeHex(obj.theme.backgroundColor, "#000000");
  const textColor = sanitizeHex(obj.theme.textColor, "#ffffff");

  let customGradient: { from: string; to: string } | null = null;
  if (backgroundMode === "gradient" && obj.theme.customGradient) {
    const from = sanitizeHex(obj.theme.customGradient.from, "");
    const to = sanitizeHex(obj.theme.customGradient.to, "");
    if (from && to) customGradient = { from, to };
  }

  const proposedFont =
    typeof obj.theme.fontFamily === "string" ? obj.theme.fontFamily.trim() : "";
  const fontFamily =
    [...allowedFonts].find(
      (a) => a.toLowerCase() === proposedFont.toLowerCase(),
    ) ?? "Inter";

  const panels: ListingPanel[] = [];
  for (const entry of obj.panels) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Partial<ListingPanel>;
    const headline = typeof p.headline === "string" ? p.headline.trim() : "";
    const subheadline =
      typeof p.subheadline === "string" ? p.subheadline.trim() : "";
    if (!headline) continue;
    const role: PanelRole = PANEL_ROLES.has(p.role as PanelRole)
      ? (p.role as PanelRole)
      : "feature";
    panels.push({ role, headline, subheadline });
  }

  if (panels.length === 0) return null;
  // If the model returned fewer panels than asked, take what it gave us
  // (better than nothing). If more, truncate to the requested count.
  const finalPanels = panels.slice(0, expectedPanels);

  return {
    theme: {
      backgroundMode,
      backgroundColor,
      customGradient,
      textColor,
      fontFamily,
    },
    panels: finalPanels,
  };
};

export const generateListing = async ({
  provider,
  model,
  idea,
  panelCount,
  brand,
}: ListingRequest): Promise<ListingResponse> => {
  const brandContext = composeBrandContext(brand);
  if (!brandContext && !idea.trim()) {
    throw new Error(
      "Need either an idea or a brand context (brand folder / brand fields) to generate a listing.",
    );
  }
  const allowedFonts = new Set(googleFonts.map((f) => f.family));

  const trimmedIdea = idea.trim();
  const userPrompt = [
    brandContext ? `Brand context (PRIMARY):\n${brandContext}` : null,
    trimmedIdea
      ? `Optional idea / angle hint from user: ${trimmedIdea}`
      : "No idea hint — design purely from the brand context above.",
    `Number of panels to generate (N): ${panelCount}`,
    "",
    `Allowed fonts (pick one for the whole set):`,
    googleFonts.map((f) => `- ${f.family} (${f.category})`).join("\n"),
    "",
    `Generate exactly ${panelCount} panels as one JSON object. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");

  // Listings can take longer than single screenshots — bump the cap.
  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 300_000,
    model,
  });

  return {
    config: parseConfig(result.text, panelCount, allowedFonts),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
