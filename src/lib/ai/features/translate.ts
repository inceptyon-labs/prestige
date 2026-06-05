/**
 * Panel copy translation.
 *
 * Translates every panel's headline + subheadline into a target locale in one
 * AI call. Used by "Duplicate as language" to spin up a localized sibling
 * project. Headlines / subheadlines are HTML strings that may carry rich-text
 * highlight markup (mark / span wrappers) — the AI is told to preserve all
 * tags and translate only the human-readable text.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";

const SYSTEM = `You are an expert App Store / Google Play screenshot localizer.
You translate short marketing copy (headlines + subheadlines) into a target language.

Rules:
- Translate for marketing impact, not word-for-word. The result must read as if a native copywriter wrote it, while keeping the same meaning and benefit.
- Keep it screenshot-friendly: roughly the same length as the source, punchy, no padding.
- Match the brand voice described in the brand context.
- Do NOT translate brand names, product names, or proper nouns.
- PRESERVE HTML EXACTLY. The headline/subheadline may contain HTML tags (e.g. <mark>, <span style="...">, attributes like data-rich-text-highlight). Keep every tag, attribute, and its position around the same words. Translate ONLY the visible human-readable text between and around tags. Never add, drop, or reorder tags.
- Each input panel has an "id". Echo the SAME id back unchanged.
- Output ONLY a JSON array of objects with this shape:
  [{"id":"...","headline":"...","subheadline":"..."}, ...]
- One object per input panel, in the same order. No prose, no markdown fences.`;

export interface TranslatePanelInput {
  id: string;
  headline: string;
  subheadline: string;
}

export interface TranslateRequest {
  provider: AIProvider;
  /** Optional model id; falls back to provider default when omitted. */
  model?: string;
  /** English display name of the target language, e.g. "Spanish". */
  targetLanguage: string;
  panels: TranslatePanelInput[];
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
  };
}

export interface TranslateResponse {
  /** Translated panels keyed by their original id. */
  panels: TranslatePanelInput[];
  raw: string;
  durationMs: number;
}

export const parseTranslatedPanels = (
  raw: string,
): TranslatePanelInput[] => {
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
    (() => {
      // Last resort: grab the outermost array literal from noisy output.
      const start = trimmed.indexOf("[");
      const end = trimmed.lastIndexOf("]");
      return start !== -1 && end > start
        ? tryParse(trimmed.slice(start, end + 1))
        : null;
    })();

  if (!Array.isArray(payload)) return [];

  const out: TranslatePanelInput[] = [];
  for (const entry of payload) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as TranslatePanelInput).id === "string" &&
      typeof (entry as TranslatePanelInput).headline === "string" &&
      typeof (entry as TranslatePanelInput).subheadline === "string"
    ) {
      const panel = entry as TranslatePanelInput;
      out.push({
        id: panel.id,
        headline: panel.headline.trim(),
        subheadline: panel.subheadline.trim(),
      });
    }
  }
  return out;
};

export const translatePanels = async ({
  provider,
  model,
  targetLanguage,
  panels,
  brand,
}: TranslateRequest): Promise<TranslateResponse> => {
  const brandContext = composeBrandContext(brand);

  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    `Target language: ${targetLanguage}`,
    "",
    "Translate the headline and subheadline of each panel below into the target language.",
    "Source panels (JSON):",
    JSON.stringify(
      panels.map((p) => ({
        id: p.id,
        headline: p.headline,
        subheadline: p.subheadline,
      })),
    ),
    "",
    "Output the translated JSON array only.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 180_000,
    model,
  });

  return {
    panels: parseTranslatedPanels(result.text),
    raw: result.text,
    durationMs: result.durationMs,
  };
};

// --- Single-field translation (inline "translate this one line" helper) ---

const SINGLE_SYSTEM = `You are an expert App Store / Google Play screenshot localizer.
You translate ONE short line of marketing copy into a target language.

Rules:
- Translate for marketing impact, not word-for-word. Read like a native copywriter wrote it.
- Keep it screenshot-friendly: roughly the same length as the source, punchy.
- Match the brand voice if given. Do NOT translate brand or product names.
- PRESERVE HTML EXACTLY. The line may contain HTML tags (e.g. <mark>, <span style="...">). Keep every tag, attribute, and its position around the same words. Translate ONLY the visible text.
- Output ONLY the translated line. No quotes, no prose, no explanations, no markdown fences.`;

export interface TranslateTextRequest {
  provider: AIProvider;
  /** Optional model id; falls back to provider default when omitted. */
  model?: string;
  /** English display name of the target language, e.g. "Spanish". */
  targetLanguage: string;
  /** The single HTML line to translate. */
  text: string;
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
  };
}

export interface TranslateTextResponse {
  text: string;
  raw: string;
  durationMs: number;
}

/**
 * Strip the conversational wrapping models sometimes add to a single-line
 * answer: code fences and a single layer of surrounding quotes. Leaves inner
 * HTML untouched.
 */
export const cleanTranslatedLine = (raw: string): string => {
  let out = raw.trim();
  const fence = out.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence) out = fence[1].trim();
  if (out.length >= 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      out = out.slice(1, -1).trim();
    }
  }
  return out;
};

export const translateText = async ({
  provider,
  model,
  targetLanguage,
  text,
  brand,
}: TranslateTextRequest): Promise<TranslateTextResponse> => {
  const brandContext = composeBrandContext(brand);

  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    `Target language: ${targetLanguage}`,
    "",
    "Translate this line into the target language. Output only the translated line:",
    text,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await provider.run(userPrompt, {
    system: SINGLE_SYSTEM,
    timeoutMs: 120_000,
    model,
  });

  return {
    text: cleanTranslatedLine(result.text),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
