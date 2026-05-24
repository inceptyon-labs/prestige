/**
 * AI provider interface.
 *
 * Prestige talks to Claude / Codex / Gemini via their local CLIs spawned
 * through Tauri's shell plugin. Each provider knows the right invocation for
 * its CLI and adapts the response into a normalized shape.
 *
 * Subscription-based, not API-keyed: the user is already authenticated to
 * their CLIs (claude, codex, gemini). We never see API keys.
 */

export type ProviderId = "claude" | "codex" | "gemini";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Short description shown next to the dropdown in the AI panel. */
  hint: string;
  /** Suggested CLI command name on PATH. */
  binary: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  claude: {
    id: "claude",
    label: "Claude",
    hint: "Best copy / strong instruction-following. Uses your Claude Code subscription.",
    binary: "claude",
  },
  codex: {
    id: "codex",
    label: "Codex",
    hint: "OpenAI Codex CLI. Uses your ChatGPT subscription.",
    binary: "codex",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    hint: "Google Gemini CLI. Long context, fast.",
    binary: "gemini",
  },
};

/**
 * A single user-style prompt. We keep the API minimal — one prompt in, one
 * text response out. Streaming / multi-turn conversation can be added later
 * once we have a feature that needs it.
 */
export interface RunOptions {
  /** Optional pre-prompt context (brand info, current screenshot state). */
  system?: string;
  /** Soft cap on response duration. */
  timeoutMs?: number;
  /**
   * Specific model id to use. When omitted the provider falls back to its
   * built-in default (CLI default OR API default). When set on a CLI
   * provider it's passed as --model. When set on an API provider it picks
   * the endpoint model directly.
   */
  model?: string;
}

export interface RunResult {
  /** Raw stdout from the CLI. */
  text: string;
  /** Provider that produced the result. */
  provider: ProviderId;
  /** Wall-clock duration in ms. */
  durationMs: number;
}

export interface AIProvider {
  readonly id: ProviderId;
  /** Returns the assistant text response, throwing on CLI error. */
  run(prompt: string, options?: RunOptions): Promise<RunResult>;
}
