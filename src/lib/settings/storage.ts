/**
 * Settings persistence to $APPDATA/settings.json.
 *
 * Uses Tauri's fs plugin (scoped to appdata in capabilities/default.json).
 * Settings are deep-merged with defaults on read so adding new fields in a
 * later version doesn't blow up older saved files.
 */

import {
  BaseDirectory,
  exists,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { isTauri } from "../runtime";
import { DEFAULT_SETTINGS, type AppSettings } from "./types";

const FILE = "settings.json";

const deepMerge = <T,>(base: T, override: Partial<T>): T => {
  if (!override) return base;
  const out: T = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const ov = override[key];
    const bv = base[key];
    if (
      ov !== null &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[key] = deepMerge(bv as object, ov as object) as T[keyof T];
    } else if (ov !== undefined) {
      out[key] = ov as T[keyof T];
    }
  }
  return out;
};

export const loadSettings = async (): Promise<AppSettings> => {
  if (!isTauri()) return DEFAULT_SETTINGS;
  try {
    const has = await exists(FILE, { baseDir: BaseDirectory.AppData });
    if (!has) return DEFAULT_SETTINGS;
    const raw = await readTextFile(FILE, { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return deepMerge(DEFAULT_SETTINGS, parsed);
  } catch (err) {
    console.warn("[settings] load failed, using defaults:", err);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  if (!isTauri()) return;
  await writeTextFile(FILE, JSON.stringify(settings, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
};
