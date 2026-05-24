/**
 * AI prompt-rewriter for image generation.
 *
 * Pipeline:
 *   1. composeEnrichedImagePrompt() builds a structured brief from the
 *      user's short idea + brand + palette + composition rules.
 *   2. This module sends that brief to a CHEAP-TIER text AI (Haiku /
 *      Flash / Mini) and asks it to rewrite into a single polished
 *      image-gen prompt — natural language, dense with brand cues, no
 *      bullet-list scaffolding that image models tend to ignore.
 *   3. The result goes to the image API.
 *
 * Falls back gracefully: callers wrap the call in try/catch and use the
 * programmatic brief if the text AI fails (keeps the happy path
 * unblocked when the text provider is misconfigured).
 */

import type { AIProvider } from "../provider";
import type { ImagePromptPurpose } from "../image/compose-prompt";

const SYSTEM = `You are an expert image-generation prompt engineer.

You will receive a structured brief: subject, brand context, palette, style notes, and composition constraints. Your job is to rewrite it as ONE polished image-generation prompt, optimized for modern image models (Imagen / Gemini Image / DALL-E).

Rules for your output:
- Lead with the SUBJECT (what is depicted), specifically and visually.
- Weave the brand voice / mood into the descriptive language — don't restate it as a section.
- Specify medium / technique / style (e.g. "soft watercolor wash", "flat-color minimalist line art", "cinematic photography"). Match the brand voice.
- Mention the palette using the exact hex codes provided, framed naturally ("dominated by warm cream #f5e8d1 and terracotta #c89b6a").
- Carry through every composition constraint verbatim (panoramic, no text, sliced into N strips, transparent background, etc.) — those are non-negotiable.
- 60-180 words. One paragraph.
- No headers, no bullets, no labels, no preamble.
- No quotes around the prompt.

Output ONLY the rewritten prompt. Nothing else.`;

export interface EnrichImagePromptRequest {
  provider: AIProvider;
  model?: string;
  /** The structured brief built by composeEnrichedImagePrompt(). */
  brief: string;
  /** Purpose tag (only used for logging / hints). */
  purpose: ImagePromptPurpose;
  /** Soft cap on the rewrite call. Defaults to 60s. */
  timeoutMs?: number;
}

export interface EnrichImagePromptResponse {
  prompt: string;
  raw: string;
  durationMs: number;
}

/**
 * Strip common things models prepend even when told not to (markdown
 * fences, "Prompt:" labels, wrapping quotes).
 */
const sanitize = (raw: string): string => {
  let text = raw.trim();
  // Strip ``` fences.
  text = text.replace(/^```(?:\w+)?\s*/m, "").replace(/```\s*$/m, "");
  // Strip leading "Prompt:" / "Output:" labels.
  text = text.replace(/^\s*(?:prompt|output|here(?:'s| is)\s+the\s+prompt)\s*:?\s*/i, "");
  // Strip surrounding quotes if the whole thing is wrapped.
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith("“") && text.endsWith("”"))
  ) {
    text = text.slice(1, -1);
  }
  return text.trim();
};

export const enrichImagePrompt = async ({
  provider,
  model,
  brief,
  timeoutMs,
}: EnrichImagePromptRequest): Promise<EnrichImagePromptResponse> => {
  const userPrompt = `${brief}\n\nReturn the polished image prompt now. One paragraph, no labels.`;
  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: timeoutMs ?? 60_000,
    model,
  });
  const cleaned = sanitize(result.text);
  if (!cleaned) {
    throw new Error("AI rewrite returned an empty prompt.");
  }
  return {
    prompt: cleaned,
    raw: result.text,
    durationMs: result.durationMs,
  };
};
