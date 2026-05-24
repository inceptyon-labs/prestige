/**
 * Content-pair generation.
 *
 * Replaces the separate headline / subheadline features. Asks the AI for 5
 * paired headline + subheadline variants in one call. Cheaper (1 CLI spawn
 * instead of 2), faster, and the AI sees both lines together so they stay
 * thematically coherent.
 */

import type { AIProvider } from "../provider";
import type { Screenshot } from "../../../types";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";

const SYSTEM = `You are an expert App Store / Google Play screenshot copywriter.
You write paired headline + subheadline copy that gets people to download apps.

Rules:
- Headline: 3 to 7 words. Punchy, benefit-driven, emotionally resonant.
- Subheadline: 6 to 14 words. Elaborates the headline — doesn't repeat it.
- Both must match the brand voice exactly.
- No emoji unless the brand voice specifies otherwise.
- Output ONLY a JSON array of exactly 5 objects with this shape:
  [{"headline":"...","subheadline":"..."}, ...]
- No prose, no markdown fences.

Example output:
[
  {"headline":"Track Every Workout","subheadline":"See progress charts that actually make sense day to day"},
  {"headline":"Crush Your Goals Daily","subheadline":"Smart reminders that match your pace, not someone else's"},
  {"headline":"Built For Real Athletes","subheadline":"Made by trainers who hated every other fitness app"},
  {"headline":"Train Smarter, Not Harder","subheadline":"AI coaching that adjusts to your sleep and energy levels"},
  {"headline":"Your Coach In Your Pocket","subheadline":"Personalized programs you can take anywhere you go"}
]`;

export interface ContentPair {
  headline: string;
  subheadline: string;
}

export interface ContentPairRequest {
  provider: AIProvider;
  /** Optional model id; falls back to provider default when omitted. */
  model?: string;
  activeScreenshot: Screenshot;
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
    screenDescription?: string;
  };
}

export interface ContentPairResponse {
  pairs: ContentPair[];
  raw: string;
  durationMs: number;
}

const parsePairs = (raw: string): ContentPair[] => {
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

  if (!Array.isArray(payload)) return [];

  const out: ContentPair[] = [];
  for (const entry of payload) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as ContentPair).headline === "string" &&
      typeof (entry as ContentPair).subheadline === "string"
    ) {
      const pair = entry as ContentPair;
      out.push({
        headline: pair.headline.trim(),
        subheadline: pair.subheadline.trim(),
      });
    }
    if (out.length >= 5) break;
  }
  return out;
};

export const generateContentPairs = async ({
  provider,
  model,
  activeScreenshot,
  brand,
}: ContentPairRequest): Promise<ContentPairResponse> => {
  const brandContext = composeBrandContext(brand);

  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    `Current screenshot context:`,
    `- Existing headline: ${activeScreenshot.headline || "(none)"}`,
    `- Existing subheadline: ${activeScreenshot.subheadline || "(none)"}`,
    `- Background color: ${activeScreenshot.backgroundColor}`,
    "",
    "Generate 5 headline + subheadline pairs. Output the JSON array only.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 180_000,
    model,
  });

  return {
    pairs: parsePairs(result.text),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
