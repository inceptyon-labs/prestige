/**
 * Claude provider — spawns the `claude` CLI in one-shot print mode.
 *
 * Invocation: `claude -p --output-format text` reads the prompt from stdin
 * and writes the assistant response to stdout. No interactive session, no
 * tool use — just a clean string in / string out, which is what we want for
 * the synchronous "generate headlines" style features.
 */

import { runShellAI } from "./shell-runner";
import type { AIProvider, RunOptions, RunResult } from "./provider";

export const claudeProvider: AIProvider = {
  id: "claude",
  async run(prompt: string, options: RunOptions = {}): Promise<RunResult> {
    const fullPrompt = options.system
      ? `${options.system}\n\n---\n\n${prompt}`
      : prompt;

    const args = [
      "-p",
      "--output-format",
      "text",
      "--dangerously-skip-permissions",
      "--add-dir",
      "/tmp",
      "--add-dir",
      "/var/folders",
    ];
    if (options.model) {
      args.push("--model", options.model);
    }
    const result = await runShellAI({
      command: "claude",
      args,
      prompt: fullPrompt,
      timeoutMs: options.timeoutMs,
    });

    return {
      text: result.stdout.trim(),
      provider: "claude",
      durationMs: result.durationMs,
    };
  },
};
