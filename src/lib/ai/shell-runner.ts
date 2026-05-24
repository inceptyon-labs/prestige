/**
 * Spawns an AI CLI via the Rust-side `run_ai_cli` Tauri command.
 *
 * Why not use @tauri-apps/plugin-shell directly?
 *   The plugin's JS Child handle can write to stdin but cannot close it.
 *   AI CLIs read until EOF, so without a close they hang until timeout.
 *   Doing the subprocess natively in Rust (tokio::process) gives us proper
 *   stdin close + timeout in one shot.
 *
 * The Rust side enforces an allowlist (claude / codex / gemini) so this can't
 * become a general-purpose shell-out from the webview.
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../runtime";

export interface ShellRunOptions {
  /** Command name (must be in the Rust-side allowlist). */
  command: string;
  /** CLI flags (e.g. ["-p"] for one-shot mode). */
  args: string[];
  /** Prompt text — written to stdin, then stdin is closed. */
  prompt: string;
  /** Optional timeout in ms. Defaults to 180s. */
  timeoutMs?: number;
  /** Extra env vars set on the child process. Inherited env is unchanged. */
  env?: Record<string, string>;
  /**
   * Optional working directory for the child. Rust restricts this to
   * /tmp/prestige/* so this can only be used for AI image-gen workspaces.
   */
  cwd?: string;
}

export interface ShellRunResult {
  stdout: string;
  stderr: string;
  code: number | null;
  durationMs: number;
}

interface RustAiCliResult {
  stdout: string;
  stderr: string;
  code: number | null;
  durationMs: number;
}

export const runShellAI = async ({
  command,
  args,
  prompt,
  timeoutMs = 180_000,
  env,
  cwd,
}: ShellRunOptions): Promise<ShellRunResult> => {
  if (!isTauri()) {
    throw new Error(
      "AI features require the desktop build. Open Prestige in Tauri to use Claude / Codex / Gemini.",
    );
  }

  // Rust side expects env as Vec<(String, String)> i.e. an array of [k, v]
  // tuples, not an object.
  const envTuples = env
    ? Object.entries(env).map(([k, v]) => [k, v] as [string, string])
    : null;

  console.log(
    `[ai] → ${command} ${args.join(" ")} (prompt ${prompt.length} chars, timeout ${timeoutMs}ms)`,
  );
  // Show the head and tail of the prompt so we always see the system instructions
  // AND the user message (the file path lives in the user message at the bottom).
  if (prompt.length > 1200) {
    console.log(
      `[ai] prompt head (first 600 chars):\n${prompt.slice(0, 600)}`,
    );
    console.log(
      `[ai] prompt tail (last 600 chars):\n${prompt.slice(-600)}`,
    );
  } else {
    console.log(`[ai] full prompt:\n${prompt}`);
  }

  const started = Date.now();
  const result = await invoke<RustAiCliResult>("run_ai_cli", {
    binary: command,
    args,
    prompt,
    timeoutMs,
    env: envTuples,
    cwd: cwd ?? null,
  });

  console.log(
    `[ai] ← ${command} exited ${result.code} in ${Date.now() - started}ms (stdout ${result.stdout.length} chars, stderr ${result.stderr.length} chars)`,
  );
  if (result.stdout) {
    console.log(
      `[ai] stdout preview:\n${result.stdout.slice(0, 500)}${result.stdout.length > 500 ? "\n…(truncated)" : ""}`,
    );
  }
  if (result.stderr) {
    console.log(
      `[ai] stderr:\n${result.stderr.slice(0, 500)}${result.stderr.length > 500 ? "\n…(truncated)" : ""}`,
    );
  }

  if (result.code !== 0) {
    throw new Error(
      `${command} exited ${result.code}: ${result.stderr || result.stdout}`.trim(),
    );
  }

  return result;
};
