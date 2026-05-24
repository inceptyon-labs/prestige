import type { AIProvider, ProviderId, RunOptions } from "./provider";
import { claudeProvider } from "./claude";
import { codexProvider } from "./codex";
import { geminiProvider } from "./gemini";
import { claudeApiProvider } from "./api/claude-api";
import { openaiApiProvider } from "./api/openai-api";
import { geminiApiTextProvider } from "./api/gemini-text-api";
import { getCurrentSettings } from "../settings/SettingsContext";
import type { ModelTier } from "../settings/types";

/**
 * Resolve a provider. Routes between CLI and direct API based on the user's
 * settings.providers[id].useApi flag. The CLI fallback still exists for
 * users who haven't entered an API key.
 */
export const getProvider = (id: ProviderId): AIProvider => {
  const cfg = getCurrentSettings().providers[id];
  if (cfg.useApi) {
    switch (id) {
      case "claude":
        return claudeApiProvider;
      case "codex":
        return openaiApiProvider;
      case "gemini":
        return geminiApiTextProvider;
    }
  }
  switch (id) {
    case "claude":
      return claudeProvider;
    case "codex":
      return codexProvider;
    case "gemini":
      return geminiProvider;
  }
};

/**
 * Resolve a model id for the given provider + tier.
 *
 * Returns `undefined` when the user hasn't picked a model — that's the
 * "use whatever the CLI/API defaults to" mode, which is the right thing
 * for subscription users who don't care about specifying a model. CLI
 * providers skip `--model` when undefined; API providers fall back to
 * their own default constant.
 *
 * For cheap tier we fall through to defaultModel when cheapModel is
 * blank, so users only have to fill one field to get something working.
 */
export const resolveModelForTier = (
  id: ProviderId,
  tier: ModelTier,
): string | undefined => {
  const cfg = getCurrentSettings().providers[id];
  const picked = tier === "cheap" ? cfg.cheapModel : cfg.defaultModel;
  if (picked?.trim()) return picked.trim();
  // Fallback for cheap → default. For default, return undefined.
  if (tier === "cheap" && cfg.defaultModel?.trim()) {
    return cfg.defaultModel.trim();
  }
  return undefined;
};

/**
 * Convenience: merge tier-appropriate model into RunOptions. Features call
 * provider.run(prompt, withTier(id, "cheap", { system, ... })) so they
 * don't have to repeat the lookup.
 */
export const withTier = (
  id: ProviderId,
  tier: ModelTier,
  base: RunOptions = {},
): RunOptions => ({
  ...base,
  model: base.model ?? resolveModelForTier(id, tier),
});
