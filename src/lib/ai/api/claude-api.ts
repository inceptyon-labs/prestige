/**
 * Direct Anthropic API client implementing AIProvider.
 *
 * Used when settings.providers.claude.useApi === true and apiKey is set.
 * Hits POST /v1/messages with a single user message (system goes into the
 * top-level system field). Returns the first text content block.
 */

import type { AIProvider, RunOptions, RunResult } from "../provider";
import { getCurrentSettings } from "../../settings/SettingsContext";

interface AnthropicMessage {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

const DEFAULT_MAX_TOKENS = 8192;

export const claudeApiProvider: AIProvider = {
  id: "claude",
  async run(prompt: string, options: RunOptions = {}): Promise<RunResult> {
    const settings = getCurrentSettings();
    const cfg = settings.providers.claude;
    if (!cfg.apiKey?.trim()) {
      throw new Error(
        "Anthropic API key missing. Open Settings → Text providers → Claude.",
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
          // Allow direct fetch from non-server origins (Tauri webview).
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: DEFAULT_MAX_TOKENS,
          ...(options.system ? { system: options.system } : {}),
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Claude API ${res.status}: ${text.slice(0, 400)}`);
      }
      const payload = (await res.json()) as AnthropicMessage;
      if (payload.error?.message) throw new Error(payload.error.message);
      const text =
        payload.content
          ?.filter((b) => b.type === "text" && typeof b.text === "string")
          .map((b) => b.text!.trim())
          .join("\n")
          .trim() ?? "";
      if (!text) throw new Error("Claude API returned no text content.");
      return { text, provider: "claude", durationMs: Date.now() - started };
    } finally {
      window.clearTimeout(timeout);
    }
  },
};
