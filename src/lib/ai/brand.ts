/**
 * Brand folder loader.
 *
 * Calls the Rust-side `read_brand_folder` command (see src-tauri/src/lib.rs)
 * which scans a project folder for a fixed set of brand/design files and
 * returns their text. Doing the read in Rust sidesteps Tauri's compile-time
 * fs scope: the user picks the folder via the dialog plugin (consent), then
 * we read it natively without having to dynamically extend the JS-side fs
 * scope at runtime.
 */

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "../runtime";

export interface BrandFolderContents {
  root: string;
  files: Record<string, string>;
  skippedOversize: string[];
}

/** Show a folder picker and return the chosen absolute path, or null. */
export const pickBrandFolder = async (): Promise<string | null> => {
  if (!isTauri()) {
    throw new Error("Folder pickers are only available in the desktop build.");
  }
  const chosen = await open({
    directory: true,
    multiple: false,
    title: "Pick a project folder for AI brand context",
  });
  if (typeof chosen === "string") return chosen;
  return null;
};

/** Read the brand reference files inside the given folder. */
export const readBrandFolder = async (
  path: string,
): Promise<BrandFolderContents> => {
  if (!isTauri()) {
    throw new Error(
      "Brand folder reading is only available in the desktop build.",
    );
  }
  return invoke<BrandFolderContents>("read_brand_folder", { path });
};

/**
 * Compose the brand context block that gets prepended to AI prompts.
 *
 * Includes the structured fields the user filled in plus any folder-derived
 * file contents. Returns null if there's nothing usable so callers can skip
 * the "Brand context: …" prefix entirely.
 */
export const composeBrandContext = (input: {
  brandName?: string;
  audience?: string;
  voice?: string;
  keyFeature?: string;
  folder?: BrandFolderContents | null;
  /**
   * Optional per-screenshot description (e.g. "the home dashboard"). When
   * provided, gives the AI specific awareness of WHAT is shown on the
   * screen it's writing copy for.
   */
  screenDescription?: string;
}): string | null => {
  const lines: string[] = [];
  if (input.brandName?.trim()) lines.push(`App name: ${input.brandName.trim()}`);
  if (input.audience?.trim()) lines.push(`Target audience: ${input.audience.trim()}`);
  if (input.voice?.trim()) lines.push(`Brand voice/tone: ${input.voice.trim()}`);
  if (input.keyFeature?.trim())
    lines.push(`Key feature: ${input.keyFeature.trim()}`);
  if (input.screenDescription?.trim())
    lines.push(`This screen shows: ${input.screenDescription.trim()}`);

  if (input.folder && Object.keys(input.folder.files).length > 0) {
    lines.push("");
    lines.push(`--- Brand reference files (from ${input.folder.root}) ---`);
    for (const [name, contents] of Object.entries(input.folder.files)) {
      lines.push(`\n### ${name}\n${contents}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
};
