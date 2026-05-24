/**
 * Shared workspace helpers for image-gen providers.
 *
 * Both backends write a PNG into /tmp/prestige/image-gen and we read it back.
 * The Rust side owns path validation (cwd must be under that prefix, reader
 * refuses paths outside it).
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../../runtime";

export interface ImageGenWorkspace {
  /** Absolute dir to set as the subprocess cwd. */
  workspace: string;
  /** Unique filename to pass as `--filename` / output target. */
  filename: string;
  /** Absolute path = workspace + "/" + filename. */
  absPath: string;
}

export const prepareImageGenWorkspace = async (): Promise<ImageGenWorkspace> => {
  if (!isTauri()) {
    throw new Error("Image generation requires the desktop build.");
  }
  return invoke<ImageGenWorkspace>("prepare_image_gen_workspace");
};

/** Read a generated image (under /tmp/prestige/image-gen) as a dataURL. */
export const readGeneratedImage = async (path: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Image generation requires the desktop build.");
  }
  return invoke<string>("read_generated_image", { path });
};

/**
 * Write a reference image (dataURL) to /tmp/prestige so the image-gen
 * subprocess can read it. Reuses the existing write_temp_image Rust command
 * which is scoped to /tmp/prestige and returns the absolute path.
 */
export const writeReferenceImage = async (dataUrl: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Image generation requires the desktop build.");
  }
  return invoke<string>("write_temp_image", { dataUrl });
};
