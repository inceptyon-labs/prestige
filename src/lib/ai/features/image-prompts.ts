/**
 * Generate image-prompt suggestions based on brand context.
 *
 * Used as a "✨ Suggest" helper next to image-prompt inputs so the user
 * doesn't have to think up a prompt from scratch. The AI reads the brand
 * folder + structured fields, considers the kind of image being asked for
 * (spanning background, overlay accent, etc.), and returns 3-6 short
 * prompt candidates the user can click to fill the input.
 */

import type { AIProvider } from "../provider";
import type { BrandFolderContents } from "../brand";
import { composeBrandContext } from "../brand";

export type ImagePromptKind =
  | "spanning-background"
  | "panel-background"
  | "overlay-accent";

const SYSTEM = `You are a senior brand designer suggesting image prompts for an App Store / Play Store screenshot designer's image-generation tool.

Read the brand context carefully. Then propose 4-6 short, vivid prompts that would each yield a strong, on-brand image. Match the brand voice and palette.

The kind of image is specified in the user message:
- "spanning-background": ONE wide panoramic image that will be sliced across N panels. Composition must read left-to-right as ONE coherent scene.
- "panel-background": A single image used as the background of one screenshot. Should feel layered behind text/devices.
- "overlay-accent": A small, isolated illustration / icon that sits on top of a background, reinforcing one feature. Minimalist, transparent-friendly.

Rules:
- Each prompt is a single sentence, 8-20 words.
- Be specific about subject, style, mood, palette. No vague words like "modern" or "clean" alone.
- Vary the prompts: don't propose 6 variants of the same idea.
- No numbering, no leading bullets, no markdown.
- Output JSON ONLY in this exact shape:
{ "prompts": ["...", "...", "..."] }`;

export interface ImagePromptsRequest {
  provider: AIProvider;
  model?: string;
  kind: ImagePromptKind;
  brand: {
    brandName?: string;
    audience?: string;
    voice?: string;
    keyFeature?: string;
    folder?: BrandFolderContents | null;
  };
  /** Optional extra context (e.g. panel headlines for spanning mode). */
  context?: string;
}

export interface ImagePromptsResponse {
  prompts: string[];
  raw: string;
  durationMs: number;
}

const parsePrompts = (raw: string): string[] => {
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
  if (!payload || typeof payload !== "object") return [];
  const arr = (payload as { prompts?: unknown }).prompts;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
};

export const generateImagePrompts = async ({
  provider,
  model,
  kind,
  brand,
  context,
}: ImagePromptsRequest): Promise<ImagePromptsResponse> => {
  const brandContext = composeBrandContext(brand);
  const userPrompt = [
    brandContext ? `Brand context:\n${brandContext}` : null,
    `Kind of image needed: ${kind}`,
    context ? `Extra context:\n${context}` : null,
    "",
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 120_000,
    model,
  });

  return {
    prompts: parsePrompts(result.text),
    raw: result.text,
    durationMs: result.durationMs,
  };
};
