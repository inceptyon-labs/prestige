/**
 * GPT Image (gpt-image-1) via the codex CLI.
 *
 * Codex has an image-generation tool internally; we drive it via `codex exec`
 * with a directive prompt telling codex to:
 *   1. Generate an image matching the user's description.
 *   2. Save it as `<filename>` in the current working directory.
 *   3. Reply with nothing but the final path (so we can parse it).
 *
 * Codex defaults to a sandbox that forbids file writes. We pass
 * `--dangerously-bypass-approvals-and-sandbox` so the image tool can land
 * the PNG. The cwd is /tmp/prestige/image-gen (the Rust side restricts cwd
 * to that prefix) so the blast radius is bounded.
 */

import { runShellAI } from "../shell-runner";
import type {
  ImageGenOptions,
  ImageGenResult,
  ImageProvider,
} from "../image-provider";
import {
  prepareImageGenWorkspace,
  readGeneratedImage,
} from "./workspace";

const buildPrompt = (
  userPrompt: string,
  filename: string,
  resolution: "1K" | "2K" | "4K",
): string => {
  const sizeHint =
    resolution === "4K"
      ? "approximately 3840x2160"
      : resolution === "2K"
        ? "approximately 2048x2048"
        : "approximately 1024x1024";
  return [
    "Generate an image using your image-generation tool, then save it to disk.",
    "",
    `Image description: ${userPrompt}`,
    "",
    `Output size: ${sizeHint}`,
    `Filename: ./${filename}`,
    "",
    "When done, respond with ONLY the absolute path to the saved file. No prose, no markdown.",
  ].join("\n");
};

export const codexImageProvider: ImageProvider = {
  id: "codex-gpt-image",
  async generate(options: ImageGenOptions): Promise<ImageGenResult> {
    if (!options.prompt.trim()) {
      throw new Error("Prompt is required.");
    }
    const ws = await prepareImageGenWorkspace();
    const started = Date.now();
    const resolution = options.resolution ?? "1K";

    await runShellAI({
      command: "codex",
      args: ["exec", "--dangerously-bypass-approvals-and-sandbox", "-"],
      prompt: buildPrompt(options.prompt, ws.filename, resolution),
      cwd: ws.workspace,
      timeoutMs: options.timeoutMs ?? 300_000,
    });

    // We don't trust codex's stdout to give us a usable path; we know exactly
    // where it should have written, so just read that path. If the file is
    // missing the reader will throw a clear error.
    const dataUrl = await readGeneratedImage(ws.absPath);
    return {
      dataUrl,
      model: "codex-gpt-image",
      durationMs: Date.now() - started,
    };
  },
};
