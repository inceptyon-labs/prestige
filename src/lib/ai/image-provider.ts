/**
 * AI image-generation provider interface.
 *
 * Phase-2 image gen has two backends:
 *   - Nano Banana Pro (Google Gemini 3 Pro Image) via the existing
 *     `~/.codex/skills/nano-banana-pro/scripts/generate_image.py` wrapper,
 *     spawned through `uv run`.
 *   - GPT Image (gpt-image-1) via `codex exec`, asking codex to invoke its
 *     image-generation tool and save the PNG to a known path.
 *
 * Both backends write a PNG into /tmp/prestige/image-gen and we read it back
 * as a data URL. The interface intentionally hides that file dance from
 * callers.
 */

export type ImageModelId = "nano-banana-pro" | "codex-gpt-image";

export interface ImageModelInfo {
  id: ImageModelId;
  label: string;
  /** Short description shown next to the picker. */
  hint: string;
  /** True when the model meaningfully supports an input reference image. */
  supportsReference: boolean;
}

export const IMAGE_MODELS: Record<ImageModelId, ImageModelInfo> = {
  "nano-banana-pro": {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    hint: "Google Gemini 3 Pro Image. Photoreal + clean illustration, fast at 1K/2K.",
    supportsReference: true,
  },
  "codex-gpt-image": {
    id: "codex-gpt-image",
    label: "GPT Image (via Codex)",
    hint: "OpenAI gpt-image-1 through the codex CLI. Uses your ChatGPT subscription.",
    supportsReference: false,
  },
};

export type ImageResolution = "1K" | "2K" | "4K";

export interface ImageGenOptions {
  /** Free-form text describing the image to generate. */
  prompt: string;
  /** Output resolution. Default 1K for fast iteration. */
  resolution?: ImageResolution;
  /** Optional reference image as a dataURL (for image-to-image edits). */
  referenceImageDataUrl?: string;
  /** Overall timeout in ms. Default 180s. */
  timeoutMs?: number;
}

export interface ImageGenResult {
  /** The generated image, ready to drop into <img src> / canvas. */
  dataUrl: string;
  /** Which model produced it. */
  model: ImageModelId;
  /** Wall-clock duration in ms. */
  durationMs: number;
}

export interface ImageProvider {
  readonly id: ImageModelId;
  generate(options: ImageGenOptions): Promise<ImageGenResult>;
}
