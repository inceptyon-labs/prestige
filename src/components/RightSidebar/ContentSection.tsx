/**
 * ContentSection Component
 *
 * Headline + subheadline editors with a single ✨ button that asks the AI
 * for 5 paired variants. Each suggestion card shows the headline and
 * subheadline together; click applies both to the active screenshot.
 */

import { AlertCircle, Check, X } from "lucide-react";
import type { Screenshot } from "../../types";
import { SidebarSection } from "./SidebarSection";
import { RichTextEditor } from "../RichTextEditor";
import { SuggestButton } from "../AISuggest";
import { useEditor } from "../../context/EditorContext";
import { useModelLabel } from "../../lib/ai/use-model-label";

interface ContentSectionProps {
  screenshot: Screenshot;
  onUpdateScreenshot: (updates: Partial<Screenshot>) => void;
}

export const ContentSection = ({
  screenshot,
  onUpdateScreenshot,
}: ContentSectionProps) => {
  const {
    isGeneratingContent,
    contentSuggestions,
    contentError,
    generateContentSuggestions,
    applyContentSuggestion,
    dismissContentSuggestions,
  } = useEditor();
  const modelLabel = useModelLabel("cheap");

  return (
    <SidebarSection title="Content">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            Headline &amp; subheadline
          </span>
          <SuggestButton
            onClick={() => void generateContentSuggestions()}
            isLoading={isGeneratingContent}
            label="Suggest pairs"
            caption={modelLabel}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Headline</label>
          <RichTextEditor
            value={screenshot.headline}
            onChange={(html) => onUpdateScreenshot({ headline: html })}
            placeholder="Enter headline..."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Subheadline</label>
          <RichTextEditor
            value={screenshot.subheadline}
            onChange={(html) => onUpdateScreenshot({ subheadline: html })}
            placeholder="Enter subheadline..."
          />
        </div>

        {contentError && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-wrap break-words flex-1">
              {contentError}
            </span>
            <button
              type="button"
              onClick={dismissContentSuggestions}
              className="text-zinc-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {contentSuggestions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                AI pairs · click to apply both
              </span>
              <button
                type="button"
                onClick={dismissContentSuggestions}
                className="text-[10px] text-zinc-500 hover:text-white"
              >
                Clear
              </button>
            </div>
            {contentSuggestions.map((pair, i) => (
              <button
                key={`${i}-${pair.headline}`}
                type="button"
                onClick={() => applyContentSuggestion(pair)}
                className="group w-full text-left bg-zinc-900 hover:bg-violet-600/20 hover:border-violet-500 border border-zinc-700 rounded px-2.5 py-1.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-100 truncate">
                      {pair.headline}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-400 line-clamp-2">
                      {pair.subheadline}
                    </div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400 flex-shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </SidebarSection>
  );
};
