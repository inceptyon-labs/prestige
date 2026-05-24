/**
 * GenerateImageModal
 *
 * Asks the user for a prompt + which model (Nano Banana Pro vs GPT Image via
 * Codex) + resolution, then either:
 *   - target="overlay": adds the generated image as a new overlay on the
 *     active screenshot, or
 *   - target="background": switches the active screenshot to image-mode bg
 *     and sets the generated image as backgroundImageSrc.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import {
  IMAGE_MODELS,
  type ImageModelId,
  type ImageResolution,
} from "../../lib/ai/image-provider";

export type ImageGenTarget = "overlay" | "background";

interface Props {
  isOpen: boolean;
  target: ImageGenTarget;
  onClose: () => void;
}

const RESOLUTIONS: ImageResolution[] = ["1K", "2K", "4K"];

export const GenerateImageModal = ({ isOpen, target, onClose }: Props) => {
  const {
    aiConfig,
    updateAIConfig,
    isGeneratingAIImage,
    generateAIImageError,
    generateAIImage,
    clearGenerateAIImageError,
  } = useEditor();

  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<ImageResolution>("1K");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Default to whichever model the user last picked, falling back to nano-banana.
  const selectedModel: ImageModelId =
    aiConfig.imageModel ?? "nano-banana-pro";

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setPrompt("");
    setResolution("1K");
    clearGenerateAIImageError();
  }, [isOpen, clearGenerateAIImageError]);

  if (!isOpen) return null;

  const setModel = (id: ImageModelId) => {
    updateAIConfig({ imageModel: id });
  };

  const submit = async () => {
    if (!prompt.trim() || isGeneratingAIImage) return;
    const ok = await generateAIImage({
      prompt,
      model: selectedModel,
      resolution,
      target,
    });
    if (ok) onClose();
  };

  // Portal + isolate + translateZ(0) defeats canvas 3D bleed-through.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ transform: "translateZ(0)" }}
    >
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              {target === "background"
                ? "Generate background image"
                : "Generate overlay image"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGeneratingAIImage}
            className="p-1 text-zinc-500 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void submit();
              }
            }}
            placeholder={
              target === "background"
                ? "e.g. soft purple aurora gradient with subtle stars"
                : "e.g. minimalist line-art icon of a coffee cup"
            }
            rows={3}
            disabled={isGeneratingAIImage}
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50 resize-none"
          />

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Model</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.values(IMAGE_MODELS) as typeof IMAGE_MODELS[ImageModelId][]).map(
                (m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m.id)}
                    disabled={isGeneratingAIImage}
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
                  disabled={isGeneratingAIImage}
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
            <p className="text-[10px] text-zinc-500 mt-1">
              Start at 1K for fast iteration. Lock the prompt before going 4K.
            </p>
          </div>

          {generateAIImageError && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="whitespace-pre-wrap break-words flex-1">
                {generateAIImageError}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isGeneratingAIImage}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!prompt.trim() || isGeneratingAIImage}
              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              {isGeneratingAIImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate
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

export default GenerateImageModal;
