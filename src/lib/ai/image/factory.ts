import type { ImageModelId, ImageProvider } from "../image-provider";
import { nanoBananaImageProvider as scriptProvider } from "./nano-banana";
import { codexImageProvider } from "./codex-image";
import { geminiApiImageProvider } from "./gemini-api";
import { getCurrentSettings } from "../../settings/SettingsContext";

export const getImageProvider = (id: ImageModelId): ImageProvider => {
  switch (id) {
    case "nano-banana-pro": {
      // Prefer the direct API when the user has it enabled + keyed. Fall
      // back to the local uv-driven script only if API is off but script
      // is enabled — otherwise the API path will surface a "missing key"
      // error which is more actionable than "script not found".
      const cfg = getCurrentSettings().image;
      if (cfg.nanoBananaApi.enabled && cfg.nanoBananaApi.apiKey?.trim()) {
        return geminiApiImageProvider;
      }
      if (cfg.nanoBananaScript.enabled) return scriptProvider;
      return geminiApiImageProvider;
    }
    case "codex-gpt-image":
      return codexImageProvider;
  }
};
