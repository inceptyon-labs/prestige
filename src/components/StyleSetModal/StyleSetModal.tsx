/**
 * StyleSetModal
 *
 * Listing-wide AI styling. Three modes:
 *   1. Coherent theme variation — AI picks per-panel themes that flow.
 *   2. Image across panels — AI generates one wide image, we slice it.
 *   3. Per-panel accent overlays — AI generates a small accent per panel.
 *
 * All three operate on the full screenshots array in EditorContext.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ImagePlus,
  Layers,
  Lightbulb,
  Loader2,
  Palette,
  Ribbon,
  Sparkles,
  X,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import {
  IMAGE_MODELS,
  type ImageModelId,
  type ImageResolution,
} from "../../lib/ai/image-provider";
import type { ImagePromptKind } from "../../lib/ai/features/image-prompts";
import { useModelLabel } from "../../lib/ai/use-model-label";

type StyleMode =
  | "coherent-theme"
  | "span-image"
  | "accent-overlays"
  | "spanning-overlay";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const RESOLUTIONS: ImageResolution[] = ["1K", "2K", "4K"];

export const StyleSetModal = ({ isOpen, onClose }: Props) => {
  const {
    screenshots,
    aiConfig,
    updateAIConfig,
    isStyleingSet,
    styleSetError,
    applyCoherentThemeAcrossSet,
    applySpanningImageAcrossSet,
    applyAccentOverlaysAcrossSet,
    applySpanningOverlayAcrossSet,
    clearStyleSetError,
    isSuggestingImagePrompts,
    imagePromptSuggestions,
    imagePromptSuggestionsError,
    suggestImagePrompts,
    clearImagePromptSuggestions,
  } = useEditor();

  const [mode, setMode] = useState<StyleMode>("coherent-theme");
  const [steer, setSteer] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [accentHint, setAccentHint] = useState("");
  const [resolution, setResolution] = useState<ImageResolution>("1K");
  const [bandPrompt, setBandPrompt] = useState("");
  const [bandStart, setBandStart] = useState(1);
  const [bandEnd, setBandEnd] = useState(screenshots.length);
  const [bandHeight, setBandHeight] = useState(40);
  const [bandAnchor, setBandAnchor] = useState<"top" | "middle" | "bottom">(
    "middle",
  );
  const [bandLayer, setBandLayer] = useState<"behind" | "front">("behind");
  const steerRef = useRef<HTMLInputElement>(null);

  const selectedModel: ImageModelId =
    aiConfig.imageModel ?? "nano-banana-pro";

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => steerRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setSteer("");
    setImagePrompt("");
    setAccentHint("");
    setResolution("1K");
    setMode("coherent-theme");
    setBandPrompt("");
    setBandStart(1);
    setBandEnd(screenshots.length);
    setBandHeight(40);
    setBandAnchor("middle");
    setBandLayer("behind");
    clearStyleSetError();
    clearImagePromptSuggestions();
  }, [isOpen, screenshots.length, clearStyleSetError, clearImagePromptSuggestions]);

  // Suggestions are per-mode — clear them when the user switches modes so
  // stale span-image prompts don't show up under accent-overlays.
  useEffect(() => {
    clearImagePromptSuggestions();
  }, [mode, clearImagePromptSuggestions]);

  if (!isOpen) return null;

  const submit = async () => {
    if (isStyleingSet) return;
    let ok = false;
    if (mode === "coherent-theme") {
      ok = await applyCoherentThemeAcrossSet(steer);
    } else if (mode === "span-image") {
      if (!imagePrompt.trim()) return;
      ok = await applySpanningImageAcrossSet({
        prompt: imagePrompt,
        model: selectedModel,
        resolution,
      });
    } else if (mode === "spanning-overlay") {
      if (!bandPrompt.trim()) return;
      ok = await applySpanningOverlayAcrossSet({
        prompt: bandPrompt,
        model: selectedModel,
        resolution,
        // UI is 1-based for friendliness; context takes 0-based indices.
        startPanelIndex: Math.max(0, bandStart - 1),
        endPanelIndex: Math.max(0, bandEnd - 1),
        bandHeightPercent: bandHeight,
        verticalAnchor: bandAnchor,
        layer: bandLayer,
      });
    } else {
      ok = await applyAccentOverlaysAcrossSet({
        promptHint: accentHint,
        model: selectedModel,
        resolution,
      });
    }
    // Only close on success. Errors stay rendered in the modal so the user
    // can read them and retry.
    if (ok) onClose();
  };

  const setModel = (id: ImageModelId) => {
    updateAIConfig({ imageModel: id });
  };

  const bandPanelCount = Math.max(
    0,
    Math.min(screenshots.length, bandEnd) - Math.max(1, bandStart) + 1,
  );

  const submitDisabled =
    isStyleingSet ||
    screenshots.length === 0 ||
    (mode === "span-image" && !imagePrompt.trim()) ||
    (mode === "spanning-overlay" &&
      (!bandPrompt.trim() || bandPanelCount <= 0));

  const submitLabel: Record<StyleMode, string> = {
    "coherent-theme": "Apply coherent theme",
    "span-image": "Generate + apply",
    "accent-overlays": `Generate ${screenshots.length} accents`,
    "spanning-overlay": `Generate band across ${bandPanelCount} panel${bandPanelCount === 1 ? "" : "s"}`,
  };

  // Defeating canvas 3D bleed-through needs all three:
  //   1. createPortal — escapes #root's stacking context entirely.
  //   2. isolate — fresh local stacking context.
  //   3. translateZ(0) — promotes the modal to its own GPU compositing layer
  //      so WebKit's layer ordering can't put the canvas's 3D device above.
  // High z-index (9999) is belt-and-suspenders for the rare case where some
  // other DOM-level element fights for position.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ transform: "translateZ(0)" }}
    >
      <div className="w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              Style the whole set ({screenshots.length} panel
              {screenshots.length === 1 ? "" : "s"})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isStyleingSet}
            className="p-1 text-zinc-500 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode picker */}
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              icon={<Palette className="w-3.5 h-3.5" />}
              label="Coherent theme"
              hint="Vary backgrounds across panels, share font."
              selected={mode === "coherent-theme"}
              onClick={() => setMode("coherent-theme")}
              disabled={isStyleingSet}
            />
            <ModeButton
              icon={<Layers className="w-3.5 h-3.5" />}
              label="Image across (bg)"
              hint="One wide image sliced across panels as background."
              selected={mode === "span-image"}
              onClick={() => setMode("span-image")}
              disabled={isStyleingSet}
            />
            <ModeButton
              icon={<Ribbon className="w-3.5 h-3.5" />}
              label="Spanning overlay"
              hint="Decorative band laid on top, spanning chosen panels."
              selected={mode === "spanning-overlay"}
              onClick={() => setMode("spanning-overlay")}
              disabled={isStyleingSet}
            />
            <ModeButton
              icon={<ImagePlus className="w-3.5 h-3.5" />}
              label="Accents"
              hint={`Per-panel accent overlay (${screenshots.length} gens).`}
              selected={mode === "accent-overlays"}
              onClick={() => setMode("accent-overlays")}
              disabled={isStyleingSet}
            />
          </div>

          {/* Mode-specific inputs */}
          {mode === "coherent-theme" && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Optional steer
              </label>
              <input
                ref={steerRef}
                type="text"
                value={steer}
                onChange={(e) => setSteer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
                placeholder="e.g. warm sunset progression, or cool blue analogous"
                disabled={isStyleingSet}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                The AI uses your brand context and the existing headlines.
                Backgrounds will vary across panels; font and palette stay
                coherent.
              </p>
            </div>
          )}

          {mode === "span-image" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-zinc-400">
                    What's the spanning image?
                  </label>
                  <SuggestButton
                    kind="spanning-background"
                    onSuggest={suggestImagePrompts}
                    isLoading={isSuggestingImagePrompts}
                    disabled={isStyleingSet}
                  />
                </div>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="e.g. a serene mountain landscape at dawn, panoramic"
                  rows={3}
                  disabled={isStyleingSet}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50 resize-none"
                />
                <SuggestionList
                  suggestions={imagePromptSuggestions}
                  error={imagePromptSuggestionsError}
                  onPick={(s) => {
                    setImagePrompt(s);
                    clearImagePromptSuggestions();
                  }}
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  One image is generated then sliced into{" "}
                  {screenshots.length} strips, one per panel. Composition
                  should read across the whole set.
                </p>
              </div>
              <ImageModelControls
                selectedModel={selectedModel}
                setModel={setModel}
                resolution={resolution}
                setResolution={setResolution}
                disabled={isStyleingSet}
              />
            </>
          )}

          {mode === "spanning-overlay" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-zinc-400">
                    What's the spanning band?
                  </label>
                  <SuggestButton
                    kind="spanning-background"
                    onSuggest={suggestImagePrompts}
                    isLoading={isSuggestingImagePrompts}
                    disabled={isStyleingSet}
                  />
                </div>
                <textarea
                  value={bandPrompt}
                  onChange={(e) => setBandPrompt(e.target.value)}
                  placeholder="e.g. a thin watercolor strip of vine leaves"
                  rows={2}
                  disabled={isStyleingSet}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50 resize-none"
                />
                <SuggestionList
                  suggestions={imagePromptSuggestions}
                  error={imagePromptSuggestionsError}
                  onPick={(s) => {
                    setBandPrompt(s);
                    clearImagePromptSuggestions();
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    From panel
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={screenshots.length}
                    value={bandStart}
                    onChange={(e) =>
                      setBandStart(Math.max(1, Number(e.target.value) || 1))
                    }
                    disabled={isStyleingSet}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    To panel
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={screenshots.length}
                    value={bandEnd}
                    onChange={(e) =>
                      setBandEnd(
                        Math.min(
                          screenshots.length,
                          Number(e.target.value) || screenshots.length,
                        ),
                      )
                    }
                    disabled={isStyleingSet}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-zinc-400">
                    Band height
                  </label>
                  <span className="text-[11px] text-zinc-300">
                    {bandHeight}% of panel
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={bandHeight}
                  onChange={(e) => setBandHeight(Number(e.target.value))}
                  disabled={isStyleingSet}
                  className="w-full accent-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Position
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["top", "middle", "bottom"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBandAnchor(p)}
                      disabled={isStyleingSet}
                      className={`text-xs py-1.5 rounded border capitalize transition-colors ${
                        bandAnchor === p
                          ? "border-violet-500 bg-violet-500/10 text-white"
                          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                      } disabled:opacity-50`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Layer
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["behind", "front"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setBandLayer(l)}
                      disabled={isStyleingSet}
                      className={`text-xs py-1.5 rounded border capitalize transition-colors ${
                        bandLayer === l
                          ? "border-violet-500 bg-violet-500/10 text-white"
                          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                      } disabled:opacity-50`}
                    >
                      {l === "behind" ? "Behind device" : "In front"}
                    </button>
                  ))}
                </div>
              </div>

              <ImageModelControls
                selectedModel={selectedModel}
                setModel={setModel}
                resolution={resolution}
                setResolution={setResolution}
                disabled={isStyleingSet}
              />
            </>
          )}

          {mode === "accent-overlays" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-zinc-400">
                    Optional style hint
                  </label>
                  <SuggestButton
                    kind="overlay-accent"
                    onSuggest={suggestImagePrompts}
                    isLoading={isSuggestingImagePrompts}
                    disabled={isStyleingSet}
                  />
                </div>
                <input
                  type="text"
                  value={accentHint}
                  onChange={(e) => setAccentHint(e.target.value)}
                  placeholder="e.g. flat-color minimalist line-art"
                  disabled={isStyleingSet}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                />
                <SuggestionList
                  suggestions={imagePromptSuggestions}
                  error={imagePromptSuggestionsError}
                  onPick={(s) => {
                    setAccentHint(s);
                    clearImagePromptSuggestions();
                  }}
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  One small overlay is generated per panel, derived from each
                  headline. Sequential generation — {screenshots.length} image
                  call
                  {screenshots.length === 1 ? "" : "s"}.
                </p>
              </div>
              <ImageModelControls
                selectedModel={selectedModel}
                setModel={setModel}
                resolution={resolution}
                setResolution={setResolution}
                disabled={isStyleingSet}
              />
            </>
          )}

          {styleSetError && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="whitespace-pre-wrap break-words flex-1">
                {styleSetError}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isStyleingSet}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitDisabled}
              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              {isStyleingSet ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Working…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  {submitLabel[mode]}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface ModeButtonProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const ModeButton = ({
  icon,
  label,
  hint,
  selected,
  onClick,
  disabled,
}: ModeButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={hint}
    className={`text-left text-xs px-2.5 py-2 rounded border transition-colors ${
      selected
        ? "border-violet-500 bg-violet-500/10 text-white"
        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
    } disabled:opacity-50`}
  >
    <div className="font-medium flex items-center gap-1.5">
      {icon}
      {label}
    </div>
    <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{hint}</div>
  </button>
);

interface ImageControlsProps {
  selectedModel: ImageModelId;
  setModel: (id: ImageModelId) => void;
  resolution: ImageResolution;
  setResolution: (r: ImageResolution) => void;
  disabled: boolean;
}

const ImageModelControls = ({
  selectedModel,
  setModel,
  resolution,
  setResolution,
  disabled,
}: ImageControlsProps) => (
  <>
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">Model</label>
      <div className="grid grid-cols-2 gap-2">
        {(Object.values(IMAGE_MODELS) as typeof IMAGE_MODELS[ImageModelId][]).map(
          (m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              disabled={disabled}
              title={m.hint}
              className={`text-left text-xs px-2.5 py-2 rounded border transition-colors ${
                selectedModel === m.id
                  ? "border-violet-500 bg-violet-500/10 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              } disabled:opacity-50`}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                {m.hint}
              </div>
            </button>
          ),
        )}
      </div>
    </div>
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">Resolution</label>
      <div className="flex gap-1.5">
        {RESOLUTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setResolution(r)}
            disabled={disabled}
            className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
              resolution === r
                ? "border-violet-500 bg-violet-500/10 text-white"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
            } disabled:opacity-50`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  </>
);

interface SuggestButtonProps {
  kind: ImagePromptKind;
  onSuggest: (kind: ImagePromptKind) => Promise<void>;
  isLoading: boolean;
  disabled: boolean;
}

const SuggestButton = ({
  kind,
  onSuggest,
  isLoading,
  disabled,
}: SuggestButtonProps) => {
  const modelLabel = useModelLabel("cheap");
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={() => void onSuggest(kind)}
        disabled={disabled || isLoading}
        title={`Get AI-suggested prompts (uses ${modelLabel})`}
        className="inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Thinking…
          </>
        ) : (
          <>
            <Lightbulb className="w-3 h-3" />
            Suggest
          </>
        )}
      </button>
      <span className="text-[9px] leading-tight text-zinc-500 font-mono">
        {modelLabel}
      </span>
    </span>
  );
};

interface SuggestionListProps {
  suggestions: string[];
  error: string | null;
  onPick: (suggestion: string) => void;
}

const SuggestionList = ({ suggestions, error, onPick }: SuggestionListProps) => {
  if (error) {
    return (
      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span className="whitespace-pre-wrap break-words flex-1">{error}</span>
      </div>
    );
  }
  if (suggestions.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(s)}
          className="w-full text-left text-[11px] text-zinc-300 hover:text-white bg-zinc-950/80 hover:bg-violet-500/10 border border-zinc-800 hover:border-violet-500/40 rounded px-2 py-1.5 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
};

export default StyleSetModal;
