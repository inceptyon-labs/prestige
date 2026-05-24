/**
 * Direct OpenAI API client implementing AIProvider.
 *
 * Uses /v1/responses for GPT-5-era models (the unified successor to
 * chat/completions) and falls back to /v1/chat/completions for older ids.
 * System prompt goes in instructions / system, user prompt as input.
 */

import type { AIProvider, RunOptions, RunResult } from "../provider";
import { getCurrentSettings } from "../../settings/SettingsContext";

interface ResponsesPayload {
  output?: {
    content?: { type?: string; text?: string }[];
  }[];
  output_text?: string;
  error?: { message?: string };
}

interface ChatPayload {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

const useResponsesApi = (model: string): boolean =>
  /^gpt-5(\.|-|$)/i.test(model) || /^o\d/i.test(model);

export const openaiApiProvider: AIProvider = {
  id: "codex",
  async run(prompt: string, options: RunOptions = {}): Promise<RunResult> {
    const settings = getCurrentSettings();
    const cfg = settings.providers.codex;
    if (!cfg.apiKey?.trim()) {
      throw new Error(
        "OpenAI API key missing. Open Settings → Text providers → Codex.",
      );
    }
    const model = options.model ?? cfg.defaultModel;
    const started = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 240_000,
    );

    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    };

    try {
      if (useResponsesApi(model)) {
        const res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          signal: controller.signal,
          headers,
          body: JSON.stringify({
            model,
            ...(options.system ? { instructions: options.system } : {}),
            input: prompt,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`OpenAI API ${res.status}: ${text.slice(0, 400)}`);
        }
        const payload = (await res.json()) as ResponsesPayload;
        if (payload.error?.message) throw new Error(payload.error.message);
        const text =
          payload.output_text?.trim() ||
          payload.output
            ?.flatMap((o) =>
              (o.content ?? [])
                .filter((c) => c.type === "output_text" || c.type === "text")
                .map((c) => c.text ?? ""),
            )
            .filter(Boolean)
            .join("\n")
            .trim();
        if (!text) throw new Error("OpenAI Responses API returned no text.");
        return { text, provider: "codex", durationMs: Date.now() - started };
      }

      // Legacy chat/completions path (gpt-4o, etc.)
      const messages = [
        ...(options.system
          ? [{ role: "system", content: options.system }]
          : []),
        { role: "user", content: prompt },
      ];
      const res = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers,
          body: JSON.stringify({ model, messages }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI API ${res.status}: ${text.slice(0, 400)}`);
      }
      const payload = (await res.json()) as ChatPayload;
      if (payload.error?.message) throw new Error(payload.error.message);
      const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("OpenAI chat API returned no text.");
      return { text, provider: "codex", durationMs: Date.now() - started };
    } finally {
      window.clearTimeout(timeout);
    }
  },
};
