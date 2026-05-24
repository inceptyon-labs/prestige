/**
 * App-wide settings: provider enable/disable, API keys, model tiers.
 *
 * Two tiers per provider:
 *   - default: used for big-effort tasks (full screenshot, listing, theme,
 *     layout — anything where the output is what the user keeps)
 *   - cheap: used for quick assistive tasks (prompt suggestions, vision
 *     descriptions, anything throwaway) so we don't burn flagship-tier
 *     spend on incidentals
 *
 * Persisted to $APPDATA/settings.json. Plain JSON — relies on disk
 * encryption (FileVault on macOS). Personal-tool tradeoff.
 */

export type ProviderId = "claude" | "codex" | "gemini";

export interface TextProviderSettings {
  enabled: boolean;
  /** Optional API key. When set, used instead of the CLI subscription. */
  apiKey?: string;
  /** Use API directly instead of the CLI. Requires apiKey when true. */
  useApi: boolean;
  /** Model used for the bulk of work (full generations, theme, layout). */
  defaultModel: string;
  /** Model used for cheap incidental tasks (suggestions, vision). */
  cheapModel: string;
}

export interface ImageGenSettings {
  /** Nano Banana via direct Gemini API (preferred — no local script). */
  nanoBananaApi: {
    enabled: boolean;
    /** Google AI Studio / Gemini API key. */
    apiKey?: string;
    /** Model id, e.g. "gemini-2.5-flash-image-preview" or "imagen-3.0-generate-002". */
    model: string;
  };
  /** Legacy: shell out to a local nano-banana-pro Python wrapper. */
  nanoBananaScript: {
    enabled: boolean;
    /** Absolute path to the generate_image.py script. */
    scriptPath: string;
  };
  /** Codex CLI image generation. */
  codexImage: {
    enabled: boolean;
  };
}

export interface AppSettings {
  providers: {
    claude: TextProviderSettings;
    codex: TextProviderSettings;
    gemini: TextProviderSettings;
  };
  image: ImageGenSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  providers: {
    // Default model fields are blank — the CLI picks its own default when
    // we don't pass --model. Users can fill them in to pin to a specific
    // model or to enable the cheap/default tier split.
    claude: {
      enabled: true,
      useApi: false,
      defaultModel: "",
      cheapModel: "",
    },
    codex: {
      enabled: true,
      useApi: false,
      defaultModel: "",
      cheapModel: "",
    },
    gemini: {
      enabled: true,
      useApi: false,
      defaultModel: "",
      cheapModel: "",
    },
  },
  image: {
    nanoBananaApi: {
      enabled: true,
      // Default blank — the user pastes their Gemini API key, clicks
      // Refresh, and picks from the actual list their account can access.
      // Hardcoding a name leads to 404s when Google renames or releases
      // new variants.
      model: "",
    },
    nanoBananaScript: {
      enabled: false,
      scriptPath:
        "/Users/Jason/.codex/skills/nano-banana-pro/scripts/generate_image.py",
    },
    codexImage: {
      enabled: true,
    },
  },
};

export type ModelTier = "default" | "cheap";

export const resolveModel = (
  provider: TextProviderSettings,
  tier: ModelTier,
): string => (tier === "cheap" ? provider.cheapModel : provider.defaultModel);
