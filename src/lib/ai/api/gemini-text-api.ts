/**
 * Direct Gemini API client implementing AIProvider for TEXT generation.
 * (For image generation see ../image/gemini-api.ts.)
 *
 * Hits POST /v1beta/models/{model}:generateContent. System prompt goes in
 * systemInstruction. Returns concatenated text from candidates[0].
 */

import type { AIProvider, RunOptions, RunResult } from "../provider";
import { getCurrentSettings } from "../../settings/SettingsContext";

interface GeminiResp {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  error?: { message?: string };
}

export const geminiApiTextProvider: AIProvider = {
  id: "gemini",
  async run(prompt: string, options: RunOptions = {}): Promise<RunResult> {
    const settings = getCurrentSettings();
    const cfg = settings.providers.gemini;
    if (!cfg.apiKey?.trim()) {
      throw new Error(
        "Gemini API key missing. Open Settings → Text providers → Gemini.",
      );
    }
    const model = options.model ?? cfg.defaultModel;
    const started = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 240_000,
    );
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(options.system
            ? {
                systemInstruction: {
                  role: "system",
                  parts: [{ text: options.system }],
                },
              }
            : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini API ${res.status}: ${text.slice(0, 400)}`);
      }
      const payload = (await res.json()) as GeminiResp;
      if (payload.error?.message) throw new Error(payload.error.message);
      const parts = payload.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((p) => p.text ?? "")
        .filter(Boolean)
        .join("\n")
        .trim();
      if (!text) throw new Error("Gemini API returned no text content.");
      return { text, provider: "gemini", durationMs: Date.now() - started };
    } finally {
      window.clearTimeout(timeout);
    }
  },
};
