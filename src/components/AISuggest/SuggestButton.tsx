/**
 * SuggestButton — small inline ✨ pill that fires an AI suggestion action.
 *
 * Standard shape: a tight button with a sparkles icon, optional label, and
 * a spinner while pending. Used everywhere inline AI suggestions surface
 * (subheadlines, palettes, fonts, full-screenshot).
 *
 * Pass `caption` (e.g. via the useModelLabel hook) to render a small "provider
 * · model" line under the button so the user can see what they're about to
 * invoke without diving into settings.
 */

import { Loader2, Sparkles } from "lucide-react";

interface Props {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  title?: string;
  className?: string;
  /** Optional small text rendered below the button (e.g. model label). */
  caption?: string;
}

export const SuggestButton = ({
  onClick,
  isLoading,
  disabled,
  label = "Suggest",
  title,
  className = "",
  caption,
}: Props) => (
  <div className="inline-flex flex-col items-end gap-0.5">
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      title={title ?? "Generate AI suggestions from brand context"}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
        isLoading
          ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-500 hover:text-violet-300"
      } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Sparkles className="w-3 h-3" />
      )}
      {label}
    </button>
    {caption && (
      <span
        className="text-[9px] leading-tight text-zinc-500 font-mono"
        title={`Will call ${caption}`}
      >
        {caption}
      </span>
    )}
  </div>
);

export default SuggestButton;
