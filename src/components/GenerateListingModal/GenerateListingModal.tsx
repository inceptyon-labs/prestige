/**
 * GenerateListingModal
 *
 * Asks the AI to produce N coherent App Store panels in one call. The user
 * picks how many panels (3–10) and whether to replace the current set or
 * append onto it.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Layers, Loader2, Sparkles, X } from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import { PROVIDERS } from "../../lib/ai/provider";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_PANELS = 3;
const MAX_PANELS = 10;

export const GenerateListingModal = ({ isOpen, onClose }: Props) => {
  const {
    aiConfig,
    brandFolderContents,
    isGeneratingListing,
    generateListingError,
    generateListingFromIdea,
    clearGenerateListingError,
  } = useEditor();

  const [idea, setIdea] = useState("");
  const [panelCount, setPanelCount] = useState(5);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setIdea("");
    setPanelCount(5);
    setMode("replace");
    clearGenerateListingError();
  }, [isOpen, clearGenerateListingError]);

  if (!isOpen) return null;

  const provider = PROVIDERS[aiConfig.provider ?? "claude"];
  const hasBrandContext = Boolean(
    brandFolderContents ||
      aiConfig.brandName?.trim() ||
      aiConfig.keyFeature?.trim() ||
      aiConfig.voice?.trim() ||
      aiConfig.audience?.trim(),
  );
  // Idea is optional when we have any brand context; otherwise we need at
  // least the idea to seed the model.
  const canSubmit = hasBrandContext || idea.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || isGeneratingListing) return;
    const ok = await generateListingFromIdea({ idea, panelCount, mode });
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
            <Layers className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              Generate full listing
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGeneratingListing}
            className="p-1 text-zinc-500 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-400">
            {provider.label} will design{" "}
            <strong className="text-zinc-200">{panelCount} matching panels</strong>{" "}
            (shared theme, sequenced hero → features → CTA) using{" "}
            {hasBrandContext ? (
              <>
                your{" "}
                <strong className="text-violet-300">
                  brand context
                </strong>{" "}
                as the source of truth.
              </>
            ) : (
              <>your one-line idea below.</>
            )}
          </p>

          {hasBrandContext && (
            <div className="text-[11px] bg-violet-500/5 border border-violet-500/20 rounded px-2 py-1.5 text-violet-200">
              ✓ Brand context loaded
              {brandFolderContents
                ? ` from ${Object.keys(brandFolderContents.files).length} file${
                    Object.keys(brandFolderContents.files).length === 1
                      ? ""
                      : "s"
                  }`
                : ""}
              {". "}
              The AI will design from this. The idea field below is a steer,
              not a brief.
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Optional angle / steer
            </label>
            <input
              ref={inputRef}
              type="text"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder={
                hasBrandContext
                  ? "e.g. lean into the social side"
                  : "e.g. a habit tracker for new parents"
              }
              disabled={isGeneratingListing}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-zinc-400">Panels</label>
              <span className="text-xs font-medium text-white">{panelCount}</span>
            </div>
            <input
              type="range"
              min={MIN_PANELS}
              max={MAX_PANELS}
              step={1}
              value={panelCount}
              onChange={(e) => setPanelCount(Number(e.target.value))}
              disabled={isGeneratingListing}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
              <span>{MIN_PANELS}</span>
              <span>{MAX_PANELS}</span>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs text-zinc-400 mb-1">
              When generation finishes
            </legend>
            <label className="flex items-start gap-2 cursor-pointer text-xs text-zinc-200">
              <input
                type="radio"
                name="listing-mode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                disabled={isGeneratingListing}
                className="mt-0.5 accent-violet-500"
              />
              <span>
                <span className="font-medium">Replace</span>
                <span className="text-zinc-500"> — clear current screenshots</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer text-xs text-zinc-200">
              <input
                type="radio"
                name="listing-mode"
                value="append"
                checked={mode === "append"}
                onChange={() => setMode("append")}
                disabled={isGeneratingListing}
                className="mt-0.5 accent-violet-500"
              />
              <span>
                <span className="font-medium">Append</span>
                <span className="text-zinc-500"> — add to existing panels</span>
              </span>
            </label>
          </fieldset>

          {generateListingError && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="whitespace-pre-wrap break-words flex-1">
                {generateListingError}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isGeneratingListing}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || isGeneratingListing}
              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              {isGeneratingListing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating {panelCount} panels…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate {panelCount} panels
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

export default GenerateListingModal;
