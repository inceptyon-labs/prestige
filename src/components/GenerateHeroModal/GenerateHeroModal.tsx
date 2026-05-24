/**
 * GenerateHeroModal
 *
 * Generates a "hero" panel: no device, no UI screenshot, just brand-
 * derived headline + subheadline + AI background image. Prepends to the
 * listing so it leads the set.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Crown,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import {
  IMAGE_MODELS,
  type ImageModelId,
  type ImageResolution,
} from "../../lib/ai/image-provider";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const RESOLUTIONS: ImageResolution[] = ["1K", "2K", "4K"];

export const GenerateHeroModal = ({ isOpen, onClose }: Props) => {
  const {
    aiConfig,
    updateAIConfig,
    brandFolderContents,
    isGeneratingHero,
    generateHeroError,
    generateHero,
    clearGenerateHeroError,
  } = useEditor();

  const [angle, setAngle] = useState("");
  const [resolution, setResolution] = useState<ImageResolution>("2K");

  const selectedModel: ImageModelId =
    aiConfig.imageModel ?? "nano-banana-pro";

  useEffect(() => {
    if (!isOpen) {
      setAngle("");
      setResolution("2K");
      clearGenerateHeroError();
    }
  }, [isOpen, clearGenerateHeroError]);

  if (!isOpen) return null;

  const hasBrandContext = Boolean(
    brandFolderContents ||
      aiConfig.brandName?.trim() ||
      aiConfig.keyFeature?.trim() ||
      aiConfig.voice?.trim() ||
      aiConfig.audience?.trim(),
  );

  const setModel = (id: ImageModelId) => updateAIConfig({ imageModel: id });

  const submit = async () => {
    if (isGeneratingHero) return;
    const ok = await generateHero({
      angle: angle.trim() || undefined,
      model: selectedModel,
      resolution,
    });
    if (ok) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ transform: "translateZ(0)" }}
    >
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              Generate hero panel
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGeneratingHero}
            className="p-1 text-zinc-500 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-400">
            A cover panel with no device, no UI — just a brand line on an
            AI-generated background. AI writes the copy AND the image from
            your brand context, then prepends the result to your listing.
          </p>

          {hasBrandContext ? (
            <div className="text-[11px] bg-violet-500/5 border border-violet-500/20 rounded px-2 py-1.5 text-violet-200">
              ✓ Brand context loaded
              {brandFolderContents
                ? ` from ${Object.keys(brandFolderContents.files).length} file${
                    Object.keys(brandFolderContents.files).length === 1
                      ? ""
                      : "s"
                  }`
                : ""}
              .
            </div>
          ) : (
            <div className="text-[11px] bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 text-amber-200">
              No brand context set yet. Fill in brand fields in the left
              sidebar (or load a brand folder) for the AI to design from.
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Optional angle / steer
            </label>
            <input
              type="text"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="e.g. lean playful, lean enterprise, dramatic, intimate"
              disabled={isGeneratingHero}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Image model
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                Object.values(IMAGE_MODELS) as typeof IMAGE_MODELS[ImageModelId][]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  disabled={isGeneratingHero}
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
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Background resolution
            </label>
            <div className="flex gap-1.5">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResolution(r)}
                  disabled={isGeneratingHero}
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

          {generateHeroError && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="whitespace-pre-wrap break-words flex-1">
                {generateHeroError}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isGeneratingHero}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isGeneratingHero}
              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              {isGeneratingHero ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Designing hero…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate hero
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

export default GenerateHeroModal;
