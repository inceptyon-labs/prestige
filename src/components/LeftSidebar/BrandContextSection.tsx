/**
 * BrandContextSection
 *
 * Lives in the LEFT sidebar as the persistent source of truth for AI
 * suggestions. Every inline ✨ button in the editor reads from this state.
 *
 * Collapsed by default once filled in to keep the sidebar tight.
 */

import { useState } from "react";
import {
  Sparkles,
  Folder,
  FolderOpen,
  Loader2,
  X,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import { PROVIDERS, type ProviderId } from "../../lib/ai/provider";

export const BrandContextSection = () => {
  const {
    aiConfig,
    updateAIConfig,
    brandFolderContents,
    brandFolderError,
    isLoadingBrandFolder,
    pickAndLoadBrandFolder,
    clearBrandFolder,
    activeScreenshot,
    isExtractingScreenDescription,
    refreshScreenDescription,
  } = useEditor();

  // Collapse by default if the user has filled anything in; expand if empty
  // so first-time setup is obvious.
  const hasContent =
    !!aiConfig.brandName ||
    !!aiConfig.audience ||
    !!aiConfig.voice ||
    !!aiConfig.keyFeature ||
    !!aiConfig.brandFolderPath;
  const [isOpen, setIsOpen] = useState(!hasContent);

  const folderPath = aiConfig.brandFolderPath;
  const folderFileCount = brandFolderContents
    ? Object.keys(brandFolderContents.files).length
    : 0;

  return (
    <div className="px-4 py-3 border-b border-zinc-800">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 mb-2 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span>Brand &amp; AI</span>
          {hasContent && !isOpen && (
            <span className="ml-1 text-[10px] text-zinc-600">
              {aiConfig.brandName || "configured"}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Screen description indicator — always visible (even when section is
          collapsed) so users can verify what the AI "sees" on the active
          screenshot. Shows a re-read button to force a fresh vision pass. */}
      <ScreenDescriptionRow
        description={activeScreenshot?.screenDescription}
        hasImage={
          !!activeScreenshot?.devices.some((d) => !!d.screenshotSrc)
        }
        isExtracting={isExtractingScreenDescription}
        onRefresh={() => void refreshScreenDescription()}
      />

      {isOpen && (
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              Provider
            </label>
            <select
              value={aiConfig.provider ?? "claude"}
              onChange={(e) =>
                updateAIConfig({ provider: e.target.value as ProviderId })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              {Object.values(PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              App name
            </label>
            <input
              type="text"
              value={aiConfig.brandName ?? ""}
              onChange={(e) => updateAIConfig({ brandName: e.target.value })}
              placeholder="e.g. Inceptyon"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              Audience
            </label>
            <input
              type="text"
              value={aiConfig.audience ?? ""}
              onChange={(e) => updateAIConfig({ audience: e.target.value })}
              placeholder="who's it for"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              Voice / tone
            </label>
            <textarea
              value={aiConfig.voice ?? ""}
              onChange={(e) => updateAIConfig({ voice: e.target.value })}
              rows={2}
              placeholder="e.g. playful, irreverent"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              Key feature
            </label>
            <input
              type="text"
              value={aiConfig.keyFeature ?? ""}
              onChange={(e) => updateAIConfig({ keyFeature: e.target.value })}
              placeholder="one-line summary"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              Brand folder
            </label>
            {folderPath ? (
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1">
                <FolderOpen className="w-3 h-3 text-violet-400 flex-shrink-0" />
                <span
                  className="text-[11px] text-zinc-300 truncate flex-1"
                  title={folderPath}
                >
                  {folderPath.split("/").slice(-2).join("/")}
                </span>
                {isLoadingBrandFolder ? (
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                ) : (
                  <span className="text-[10px] text-zinc-500">
                    {folderFileCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearBrandFolder}
                  className="p-0.5 text-zinc-500 hover:text-white"
                  title="Disconnect folder"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void pickAndLoadBrandFolder()}
                className="w-full flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 transition-colors"
              >
                <Folder className="w-3 h-3" />
                Point at project folder
              </button>
            )}
            {brandFolderError && (
              <div className="mt-1 flex items-start gap-1 text-[10px] text-red-400">
                <AlertCircle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
                <span className="break-all">{brandFolderError}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ScreenDescriptionRowProps {
  description?: string;
  hasImage: boolean;
  isExtracting: boolean;
  onRefresh: () => void;
}

const ScreenDescriptionRow = ({
  description,
  hasImage,
  isExtracting,
  onRefresh,
}: ScreenDescriptionRowProps) => {
  let body: React.ReactNode;
  let tone = "text-zinc-500";
  if (isExtracting) {
    body = (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Reading screen…
      </span>
    );
    tone = "text-zinc-300";
  } else if (description) {
    body = <span title={description}>{description}</span>;
    tone = "text-zinc-300";
  } else if (!hasImage) {
    body = <span>no screen image uploaded</span>;
  } else {
    body = <span>not read yet — click ✨ to extract</span>;
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 text-[10px]">
      <Eye className={`w-3 h-3 flex-shrink-0 ${tone}`} />
      <span className={`flex-1 truncate ${tone}`}>{body}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={!hasImage || isExtracting}
        title="Re-read the screen image"
        className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw
          className={`w-3 h-3 ${isExtracting ? "animate-spin" : ""}`}
        />
      </button>
    </div>
  );
};

export default BrandContextSection;
