/**
 * Nano Banana Pro image-gen provider.
 *
 * Invokes the user's `~/.codex/skills/nano-banana-pro/scripts/generate_image.py`
 * wrapper via `uv run`. The script reads --prompt and writes a PNG to the
 * current working directory using the provided --filename. We point cwd at
 * /tmp/prestige/image-gen so the output lands somewhere the Rust file reader
 * is willing to serve back to the webview.
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
  writeReferenceImage,
} from "./workspace";
import { getCurrentSettings } from "../../settings/SettingsContext";

export const nanoBananaImageProvider: ImageProvider = {
  id: "nano-banana-pro",
  async generate(options: ImageGenOptions): Promise<ImageGenResult> {
    if (!options.prompt.trim()) {
      throw new Error("Prompt is required.");
    }
    const settings = getCurrentSettings();
    const scriptPath = settings.image.nanoBananaScript.scriptPath?.trim();
    if (!scriptPath) {
      throw new Error(
        "Nano Banana script path is not set. Open Settings → Image generation, or switch to the Gemini API path.",
      );
    }
    const ws = await prepareImageGenWorkspace();
    const started = Date.now();

    const args = [
      "run",
      scriptPath,
      "--prompt",
      options.prompt,
      "--filename",
      ws.filename,
      "--resolution",
      options.resolution ?? "1K",
    ];

    if (options.referenceImageDataUrl) {
      const refPath = await writeReferenceImage(options.referenceImageDataUrl);
      args.push("--input-image", refPath);
    }

    await runShellAI({
      command: "uv",
      args,
      // uv reads no stdin for this script; pass an empty prompt.
      prompt: "",
      cwd: ws.workspace,
      timeoutMs: options.timeoutMs ?? 180_000,
    });

    const dataUrl = await readGeneratedImage(ws.absPath);
    return {
      dataUrl,
      model: "nano-banana-pro",
      durationMs: Date.now() - started,
    };
  },
};
