/**
 * LanguageMenuButton — small inline 🌐 button that opens a language picker and
 * fires `onSelect(localeKey)`. Used for the per-field "translate this line"
 * helper next to headline / subheadline editors.
 *
 * The menu is portal-rendered and fixed-positioned to the trigger so it isn't
 * clipped by the scrollable sidebar.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Languages, Loader2 } from "lucide-react";
import { LOCALES } from "../../constants";

interface Props {
  onSelect: (localeKey: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  title?: string;
}

export const LanguageMenuButton = ({
  onSelect,
  isLoading,
  disabled,
  title = "Translate this field",
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - 176 });
  }, [isOpen]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen((v) => !v)}
        title={title}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
          isLoading
            ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
            : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-500 hover:text-violet-300"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Languages className="w-3 h-3" />
        )}
        Translate
      </button>
      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            data-language-menu
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="w-44 max-h-72 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[120]"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-900">
              Translate to
            </div>
            {LOCALES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => {
                  onSelect(l.key);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                {l.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
};

export default LanguageMenuButton;
