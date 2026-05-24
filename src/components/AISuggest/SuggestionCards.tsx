/**
 * SuggestionCards — small list of clickable suggestions rendered under the
 * relevant editable. Each card calls onApply when clicked; the X button
 * dismisses the whole list.
 */

import { AlertCircle, Check, X } from "lucide-react";

interface Props {
  suggestions: string[];
  onApply: (suggestion: string) => void;
  onDismiss: () => void;
  error?: string | null;
  /**
   * Optional renderer for the card body. Defaults to plain text. Override
   * for swatches / font previews / etc.
   */
  renderCard?: (suggestion: string) => React.ReactNode;
}

export const SuggestionCards = ({
  suggestions,
  onApply,
  onDismiss,
  error,
  renderCard,
}: Props) => {
  if (error) {
    return (
      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span className="whitespace-pre-wrap break-words flex-1">{error}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-zinc-500 hover:text-white"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          AI suggestions · click to apply
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[10px] text-zinc-500 hover:text-white"
        >
          Clear
        </button>
      </div>
      {suggestions.map((s, i) => (
        <button
          key={`${i}-${s}`}
          type="button"
          onClick={() => onApply(s)}
          className="group w-full flex items-center justify-between gap-2 text-left bg-zinc-900 hover:bg-violet-600/20 hover:border-violet-500 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 transition-colors"
        >
          {renderCard ? renderCard(s) : <span className="truncate">{s}</span>}
          <Check className="w-3 h-3 text-zinc-600 group-hover:text-violet-400 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
};

export default SuggestionCards;
