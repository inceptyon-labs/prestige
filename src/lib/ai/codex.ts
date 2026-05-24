/**
 * Codex provider — spawns the `codex` CLI in non-interactive exec mode.
 *
 * `codex exec` is the one-shot subcommand: the prompt comes from stdin (or
 * a positional arg) and the response goes to stdout. We feed stdin to keep
 * long prompts off the command line.
 */

import { runShellAI } from "./shell-runner";
import type { AIProvider, RunOptions, RunResult } from "./provider";

export const codexProvider: AIProvider = {
  id: "codex",
  async run(prompt: string, options: RunOptions = {}): Promise<RunResult> {
    const fullPrompt = options.system
      ? `${options.system}\n\n---\n\n${prompt}`
      : prompt;

    const args = ["exec"];
    if (options.model) args.push("--model", options.model);
    args.push("-");
    const result = await runShellAI({
      command: "codex",
      args,
      prompt: fullPrompt,
      timeoutMs: options.timeoutMs,
    });

    return {
      text: result.stdout.trim(),
      provider: "codex",
      durationMs: result.durationMs,
    };
  },
};
