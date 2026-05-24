/**
 * Vision: extract a one-line description of what's shown in a screenshot.
 *
 * Why this exists:
 *   The text-based AI features (content, theme, layout) write better copy
 *   when they know WHAT the screen actually shows. Without a description
 *   they just guess from brand voice. With one, "Track Every Workout" pairs
 *   with the workouts screen and not the leaderboard.
 *
 * Pipeline:
 *   1. Caller materializes the screenshot data URL to a temp file via the
 *      Rust write_temp_image command.
 *   2. We hand the file path to the AI CLI as @path so Claude Code / Gemini
 *      can use their built-in file-reading capabilities to look at it.
 *   3. Output is cached on Screenshot.screenDescription so we only do this
 *      once per upload.
 *
 * Note on provider support:
 *   - Claude Code: reads files via its Read tool. Works.
 *   - Gemini CLI: similar @file syntax. Works.
 *   - Codex CLI: limited image support; we still pass the path but copy may
 *     be less specific if it can't read the image. Caller code degrades
 *     gracefully (empty description = no context).
 */

import { invoke } from "@tauri-apps/api/core";
import type { AIProvider } from "../provider";
import { isTauri } from "../../runtime";

const SYSTEM = `You analyze app screenshots and return a single short description.

Given a path to a screenshot image:
1. USE YOUR Read TOOL to actually open and view the image file. Don't guess from the filename.
2. Look at what's actually on the screen — buttons, lists, headers, content.
3. Return ONE short clause (5-12 words) naming what the screen IS and what it shows.

Output ONLY the description text. No JSON, no prose framing, no quotes, no trailing punctuation.

Examples of good output:
  the home dashboard with daily progress charts
  the in-app shop showing item bundles for purchase
  the workouts list with categories
  the leaderboard ranked by weekly distance
  the onboarding sign-up screen`;

const writeTempImage = async (dataUrl: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Vision requires the desktop build.");
  }
  return invoke<string>("write_temp_image", { dataUrl });
};

export interface ScreenDescriptionRequest {
  provider: AIProvider;
  model?: string;
  /** Screenshot data URL (data:image/png;base64,...). */
  imageDataUrl: string;
}

export interface ScreenDescriptionResponse {
  description: string;
  raw: string;
  durationMs: number;
  /** Temp file path the image was written to. */
  imagePath: string;
}

const cleanDescription = (raw: string): string => {
  // Strip code fences, quotes, leading bullets, and clamp to ~80 chars so
  // we never inject a paragraph into downstream prompts.
  const text = raw
    .trim()
    .replace(/^```(?:\w+)?\s*([\s\S]*?)```$/m, "$1")
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\.+$/, "")
    .trim();
  return text.length > 100 ? `${text.slice(0, 100)}…` : text;
};

export const extractScreenDescription = async ({
  provider,
  model,
  imageDataUrl,
}: ScreenDescriptionRequest): Promise<ScreenDescriptionResponse> => {
  console.log(
    `[vision] starting extraction via ${provider.id} (dataUrl ${imageDataUrl.length} chars)`,
  );
  const imagePath = await writeTempImage(imageDataUrl);
  console.log(`[vision] wrote temp image to: ${imagePath}`);

  const userPrompt = `Read the screenshot at this absolute path and describe what app screen it shows:\n\n${imagePath}\n\nReturn just the description.`;

  const result = await provider.run(userPrompt, {
    system: SYSTEM,
    timeoutMs: 180_000,
    model,
  });

  const description = cleanDescription(result.text);
  console.log(
    `[vision] extracted description: ${JSON.stringify(description)} (raw: ${JSON.stringify(result.text.slice(0, 200))})`,
  );

  return {
    description,
    raw: result.text,
    durationMs: result.durationMs,
    imagePath,
  };
};
