/**
 * Direct Gemini API image generation.
 *
 * Hits Google's Generative Language API with the model + key from
 * AppSettings. Replaces the uv-driven nano-banana script — no external
 * dependencies, runs entirely in-process (well, in webview + fetch).
 *
 * The Imagen models support aspect ratios via the generationConfig but
 * many also accept a plain text prompt. We use the standard
 * generateContent endpoint for the image-preview Gemini models, and the
 * predict endpoint for imagen-3 models. We branch on the model name.
 */

import type {
  ImageGenOptions,
  ImageGenResult,
  ImageProvider,
} from "../image-provider";
import { getCurrentSettings } from "../../settings/SettingsContext";

interface InlineDataPart {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: InlineDataPart[];
    };
  }[];
  error?: { message?: string };
}

interface ImagenPredictResponse {
  predictions?: {
    bytesBase64Encoded?: string;
    mimeType?: string;
  }[];
  error?: { message?: string };
}

const callGeminiImagePreview = async (
  model: string,
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> => {
  // generateContent endpoint with responseModalities to include IMAGE.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 400)}`);
  }
  const payload = (await res.json()) as GeminiResponse;
  if (payload.error?.message) throw new Error(payload.error.message);
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      const mime = p.inlineData.mimeType ?? "image/png";
      return `data:${mime};base64,${p.inlineData.data}`;
    }
  }
  throw new Error("Gemini API returned no image data.");
};

const callImagenPredict = async (
  model: string,
  apiKey: string,
  prompt: string,
  aspectRatio: string,
  signal?: AbortSignal,
): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Imagen API ${res.status}: ${text.slice(0, 400)}`);
  }
  const payload = (await res.json()) as ImagenPredictResponse;
  if (payload.error?.message) throw new Error(payload.error.message);
  const first = payload.predictions?.[0];
  if (!first?.bytesBase64Encoded)
    throw new Error("Imagen API returned no image data.");
  const mime = first.mimeType ?? "image/png";
  return `data:${mime};base64,${first.bytesBase64Encoded}`;
};

export const geminiApiImageProvider: ImageProvider = {
  id: "nano-banana-pro",
  async generate(options: ImageGenOptions): Promise<ImageGenResult> {
    if (!options.prompt.trim()) throw new Error("Prompt is required.");
    const settings = getCurrentSettings();
    const cfg = settings.image.nanoBananaApi;
    if (!cfg.enabled) {
      throw new Error(
        "Gemini image API is disabled in settings. Enable it or pick a different model.",
      );
    }
    if (!cfg.apiKey?.trim()) {
      throw new Error(
        "Gemini API key is missing. Open Settings → Image generation and paste your key.",
      );
    }
    const started = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 240_000,
    );
    try {
      const model = cfg.model;
      const isImagen = model.startsWith("imagen-");
      // Imagen aspect ratio mapping: 1K/2K/4K aren't aspect ratios — they're
      // resolutions. Imagen accepts "1:1", "3:4", "4:3", "9:16", "16:9".
      // We default to 1:1; the slicing layer crops further as needed.
      const aspectRatio = "1:1";
      const dataUrl = isImagen
        ? await callImagenPredict(
            model,
            cfg.apiKey,
            options.prompt,
            aspectRatio,
            controller.signal,
          )
        : await callGeminiImagePreview(
            model,
            cfg.apiKey,
            options.prompt,
            controller.signal,
          );
      return {
        dataUrl,
        model: "nano-banana-pro",
        durationMs: Date.now() - started,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  },
};
