/**
 * Gemini provider — spawns the `gemini` CLI in one-shot mode.
 *
 * `gemini -p <prompt>` accepts the prompt as an arg or stdin. We use stdin
 * for the same reasons as the other providers (long prompts + special chars).
 */

import { runShellAI } from "./shell-runner";
import type { AIProvider, RunOptions, RunResult } from "./provider";

export const geminiProvider: AIProvider = {
  id: "gemini",
  async run(prompt: string, options: RunOptions = {}): Promise<RunResult> {
    const fullPrompt = options.system
      ? `${options.system}\n\n---\n\n${prompt}`
      : prompt;

    const args = ["--skip-trust"];
    if (options.model) args.push("-m", options.model);
    args.push("-p", "-");
    const result = await runShellAI({
      command: "gemini",
      args,
      prompt: fullPrompt,
      timeoutMs: options.timeoutMs,
      // Gemini CLI ships with an OpenTelemetry exporter that tries to phone
      // home to a stale endpoint and crashes on shutdown (exit 55). The
      // response itself generates fine — we just need to silence telemetry
      // so the CLI exits cleanly.
      env: {
        OTEL_SDK_DISABLED: "true",
        GEMINI_TELEMETRY: "false",
        GEMINI_CLI_TRUST_WORKSPACE: "true",
      },
    });

    return {
      text: result.stdout.trim(),
      provider: "gemini",
      durationMs: result.durationMs,
    };
  },
};
