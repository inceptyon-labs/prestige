/**
 * GenerateScreenshotModal
 *
 * Asks the user for a one-line "idea" for a new screenshot, then asks the AI
 * to scaffold headline + subheadline + colors + font from the brand context.
 * The new screenshot is appended and switched to on success.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, Sparkles, X } from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import { PROVIDERS } from "../../lib/ai/provider";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GenerateScreenshotModal = ({ isOpen, onClose }: Props) => {
  const {
    aiConfig,
    isGeneratingFullScreenshot,
    generateFullScreenshotError,
    generateFullScreenshotFromIdea,
    clearGenerateFullScreenshotError,
  } = useEditor();

  const [idea, setIdea] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the input shortly after open so autofocus survives portal mount.
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // Reset state when closed.
    setIdea("");
    clearGenerateFullScreenshotError();
  }, [isOpen, clearGenerateFullScreenshotError]);

  if (!isOpen) return null;

  const provider = PROVIDERS[aiConfig.provider ?? "claude"];

  const submit = async () => {
    if (!idea.trim() || isGeneratingFullScreenshot) return;
    const ok = await generateFullScreenshotFromIdea(idea);
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
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              Generate screenshot from brand
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGeneratingFullScreenshot}
            className="p-1 text-zinc-500 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-zinc-400">
            Describe the screenshot in one line. {provider.label} will scaffold
            the headline, subheadline, colors, and font using your brand context
            in the left sidebar.
          </p>

          <input
            ref={inputRef}
            type="text"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="e.g. the home dashboard showing daily streaks"
            disabled={isGeneratingFullScreenshot}
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />

          {generateFullScreenshotError && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="whitespace-pre-wrap break-words flex-1">
                {generateFullScreenshotError}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGeneratingFullScreenshot}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!idea.trim() || isGeneratingFullScreenshot}
              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              {isGeneratingFullScreenshot ? (
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

export default GenerateScreenshotModal;
