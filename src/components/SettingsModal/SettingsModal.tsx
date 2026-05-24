/**
 * SettingsModal
 *
 * Provider enable/disable, API keys, model selection.
 * Settings persist to $APPDATA/settings.json via SettingsContext.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useSettings } from "../../lib/settings/SettingsContext";
import type {
  AppSettings,
  ProviderId,
  TextProviderSettings,
} from "../../lib/settings/types";
import {
  listClaudeModels,
  listGeminiImageModels,
  listGeminiModels,
  listOpenAIModels,
} from "../../lib/ai/api/list-models";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: "Claude (Anthropic)",
  codex: "Codex / OpenAI",
  gemini: "Gemini (Google)",
};

// Curated subscription-friendly model lists. Maintained by hand because
// API /models endpoints return everything (embeddings, audio, legacy)
// and don't tell us what's available at the user's subscription tier.
// Edit this list as new models ship.
//
// When the user clicks Refresh with an API key, the fetched list replaces
// these for that provider — useful for users on tiers with access to
// more models than the curated default.
const FALLBACK_MODELS: Record<ProviderId, { default: string[]; cheap: string[] }> = {
  claude: {
    default: ["claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6"],
    cheap: ["claude-haiku-4-5", "claude-sonnet-4-6"],
  },
  codex: {
    // Per user: GPT-5.5 is current. Include the tier variants typically
    // available on a Plus / Pro ChatGPT subscription via Codex CLI.
    default: ["gpt-5.5", "gpt-5", "gpt-5-codex"],
    cheap: ["gpt-5.5-mini", "gpt-5-mini", "gpt-5-nano"],
  },
  gemini: {
    // Per user: Gemini 3.1 is current.
    default: ["gemini-3.1-pro", "gemini-3-pro", "gemini-2.5-pro"],
    cheap: ["gemini-3.1-flash", "gemini-3-flash", "gemini-2.5-flash"],
  },
};

export const SettingsModal = ({ isOpen, onClose }: Props) => {
  const { settings, updateSettings, isHydrated } = useSettings();
  // Local draft state so the user can cancel without saving.
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  // Fetched-from-API model lists, keyed by provider. Empty until user
  // clicks Refresh. Falls back to FALLBACK_MODELS when empty.
  const [fetchedModels, setFetchedModels] = useState<
    Record<ProviderId, string[]>
  >({ claude: [], codex: [], gemini: [] });
  const [refreshing, setRefreshing] = useState<Partial<Record<ProviderId, boolean>>>(
    {},
  );
  const [refreshErrors, setRefreshErrors] = useState<
    Partial<Record<ProviderId, string>>
  >({});

  // Image-gen model list — fetched from the Gemini API key in the image
  // section. Separate from the text-Gemini list above because the user
  // wants different filtering (image-capable only).
  const [imageModels, setImageModels] = useState<string[]>([]);
  const [imageRefreshing, setImageRefreshing] = useState(false);
  const [imageRefreshError, setImageRefreshError] = useState<string | null>(
    null,
  );

  const refreshImageModels = async () => {
    setImageRefreshing(true);
    setImageRefreshError(null);
    try {
      const key =
        draft.image.nanoBananaApi.apiKey?.trim() ||
        draft.providers.gemini.apiKey?.trim() ||
        "";
      if (!key) throw new Error("Paste your Gemini API key first.");
      const models = await listGeminiImageModels(key);
      setImageModels(models);
      if (models.length === 0) {
        setImageRefreshError(
          "No image-capable Gemini models found on this account.",
        );
      }
    } catch (err) {
      setImageRefreshError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setImageRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) setDraft(settings);
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const updateProvider = (
    id: ProviderId,
    patch: Partial<TextProviderSettings>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [id]: { ...prev.providers[id], ...patch },
      },
    }));
  };

  const save = () => {
    updateSettings(draft);
    onClose();
  };

  const toggleKey = (id: string) =>
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));

  const refreshModels = async (id: ProviderId) => {
    setRefreshing((prev) => ({ ...prev, [id]: true }));
    setRefreshErrors((prev) => ({ ...prev, [id]: undefined }));
    try {
      // For Gemini, fall back to the image-gen Gemini key — it's the same
      // vendor and most users already pasted it once for image gen.
      let key = draft.providers[id].apiKey ?? "";
      if (id === "gemini" && !key.trim()) {
        key = draft.image.nanoBananaApi.apiKey ?? "";
      }
      if (!key.trim()) {
        throw new Error(
          "No API key set. Paste one above (it's used only for the model-list lookup; generations can still use the CLI).",
        );
      }
      const models =
        id === "claude"
          ? await listClaudeModels(key)
          : id === "codex"
            ? await listOpenAIModels(key)
            : await listGeminiModels(key);
      setFetchedModels((prev) => ({ ...prev, [id]: models }));
    } catch (err) {
      setRefreshErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setRefreshing((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Suggestions to show per provider: fetched if available, otherwise fallback.
  const modelSuggestions = (id: ProviderId) => {
    const fetched = fetchedModels[id];
    if (fetched.length > 0) {
      return { default: fetched, cheap: fetched };
    }
    return FALLBACK_MODELS[id];
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ transform: "translateZ(0)" }}
    >
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-6 flex-1">
          {!isHydrated && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading settings…
            </div>
          )}

          {/* Text providers */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Text providers
            </h3>
            <div className="space-y-4">
              {(["claude", "codex", "gemini"] as ProviderId[]).map((id) => {
                const p = draft.providers[id];
                return (
                  <div
                    key={id}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) =>
                            updateProvider(id, { enabled: e.target.checked })
                          }
                          className="accent-violet-500"
                        />
                        {PROVIDER_LABELS[id]}
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          checked={p.useApi}
                          onChange={(e) =>
                            updateProvider(id, { useApi: e.target.checked })
                          }
                          className="accent-violet-500"
                        />
                        Use API instead of CLI
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        API key{" "}
                        <span className="text-zinc-600">
                          {p.useApi
                            ? "(required — used for generations)"
                            : "(optional — used only to refresh model list)"}
                        </span>
                      </label>
                      <div className="flex gap-1">
                        <input
                          type={showKeys[id] ? "text" : "password"}
                          value={p.apiKey ?? ""}
                          onChange={(e) =>
                            updateProvider(id, { apiKey: e.target.value })
                          }
                          placeholder="paste your API key"
                          className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKey(id)}
                          className="p-1.5 text-zinc-500 hover:text-white border border-zinc-700 rounded"
                        >
                          {showKeys[id] ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-zinc-500 leading-snug">
                        {fetchedModels[id].length > 0
                          ? `${fetchedModels[id].length} models fetched.`
                          : "Leave blank to use the CLI's default. Or paste an API key + Refresh to see the actual current model ids."}
                      </span>
                      <button
                        type="button"
                        onClick={() => void refreshModels(id)}
                        disabled={refreshing[id]}
                        title={
                          id === "gemini" &&
                          !p.apiKey?.trim() &&
                          draft.image.nanoBananaApi.apiKey?.trim()
                            ? "Uses your image-gen Gemini key for the model list"
                            : "Fetch available models from the provider API"
                        }
                        className="inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 disabled:opacity-50 shrink-0"
                      >
                        {refreshing[id] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Refresh
                      </button>
                    </div>
                    {refreshErrors[id] && (
                      <div className="flex items-start gap-1 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="whitespace-pre-wrap break-words flex-1">
                          {refreshErrors[id]}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <ModelField
                        label="Default model (heavy tasks)"
                        value={p.defaultModel}
                        suggestions={modelSuggestions(id).default}
                        onChange={(v) => updateProvider(id, { defaultModel: v })}
                      />
                      <ModelField
                        label="Cheap model (suggestions)"
                        value={p.cheapModel}
                        suggestions={modelSuggestions(id).cheap}
                        onChange={(v) => updateProvider(id, { cheapModel: v })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Image generation */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5" /> Image generation
            </h3>
            <div className="space-y-4">
              {/* Gemini API path */}
              <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={draft.image.nanoBananaApi.enabled}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          image: {
                            ...prev.image,
                            nanoBananaApi: {
                              ...prev.image.nanoBananaApi,
                              enabled: e.target.checked,
                            },
                          },
                        }))
                      }
                      className="accent-violet-500"
                    />
                    Nano Banana (Gemini API, recommended)
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Gemini / Google AI Studio API key
                  </label>
                  <div className="flex gap-1">
                    <input
                      type={showKeys["nano-banana-api"] ? "text" : "password"}
                      value={draft.image.nanoBananaApi.apiKey ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          image: {
                            ...prev.image,
                            nanoBananaApi: {
                              ...prev.image.nanoBananaApi,
                              apiKey: e.target.value,
                            },
                          },
                        }))
                      }
                      placeholder="AIzaSy…"
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleKey("nano-banana-api")}
                      className="p-1.5 text-zinc-500 hover:text-white border border-zinc-700 rounded"
                    >
                      {showKeys["nano-banana-api"] ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Get a free key at{" "}
                    <span className="text-violet-300">
                      aistudio.google.com/apikey
                    </span>
                    .
                  </p>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] text-zinc-500 leading-snug">
                    {imageModels.length > 0
                      ? `${imageModels.length} image-capable models on your account.`
                      : "Paste your Gemini API key above and Refresh to see the actual image models your account can access."}
                  </span>
                  <button
                    type="button"
                    onClick={() => void refreshImageModels()}
                    disabled={imageRefreshing}
                    className="inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 disabled:opacity-50 shrink-0"
                  >
                    {imageRefreshing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Refresh
                  </button>
                </div>
                {imageRefreshError && (
                  <div className="flex items-start gap-1 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-wrap break-words flex-1">
                      {imageRefreshError}
                    </span>
                  </div>
                )}
                <ModelField
                  label="Model"
                  value={draft.image.nanoBananaApi.model}
                  suggestions={imageModels}
                  onChange={(v) =>
                    setDraft((prev) => ({
                      ...prev,
                      image: {
                        ...prev.image,
                        nanoBananaApi: {
                          ...prev.image.nanoBananaApi,
                          model: v,
                        },
                      },
                    }))
                  }
                />
              </div>

              {/* Legacy script path */}
              <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={draft.image.nanoBananaScript.enabled}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        image: {
                          ...prev.image,
                          nanoBananaScript: {
                            ...prev.image.nanoBananaScript,
                            enabled: e.target.checked,
                          },
                        },
                      }))
                    }
                    className="accent-violet-500"
                  />
                  Nano Banana via local script (legacy)
                </label>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Absolute path to generate_image.py
                  </label>
                  <input
                    type="text"
                    value={draft.image.nanoBananaScript.scriptPath}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        image: {
                          ...prev.image,
                          nanoBananaScript: {
                            ...prev.image.nanoBananaScript,
                            scriptPath: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="/Users/you/.codex/skills/nano-banana-pro/scripts/generate_image.py"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Codex image */}
              <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={draft.image.codexImage.enabled}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        image: {
                          ...prev.image,
                          codexImage: {
                            ...prev.image.codexImage,
                            enabled: e.target.checked,
                          },
                        },
                      }))
                    }
                    className="accent-violet-500"
                  />
                  GPT Image via codex CLI
                </label>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 rounded px-3 py-1.5 text-xs font-medium text-white"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface ModelFieldProps {
  label: string;
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
}

const ModelField = ({
  label,
  value,
  suggestions,
  onChange,
}: ModelFieldProps) => (
  <div>
    <label className="block text-[11px] text-zinc-400 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="(CLI default)"
      list={`${label.replace(/\s+/g, "-")}-models`}
      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
    />
    <datalist id={`${label.replace(/\s+/g, "-")}-models`}>
      {suggestions.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
    <div className="flex flex-wrap gap-1 mt-1">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            value === s
              ? "border-violet-500 bg-violet-500/10 text-white"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  </div>
);

export default SettingsModal;
