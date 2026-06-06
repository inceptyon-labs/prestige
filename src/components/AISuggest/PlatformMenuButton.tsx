/**
 * PlatformMenuButton — small inline ▦ button that opens a platform picker and
 * fires `onSelect(platformKey)`. Used to spin up a project as a new platform
 * variant, both on individual project rows and on platform subgroup headers in
 * the project switcher.
 *
 * The menu is portal-rendered and fixed-positioned to the trigger so it isn't
 * clipped by the scrollable dropdown.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Layers } from "lucide-react";
import { PLATFORMS } from "../../constants";
import type { PlatformKey } from "../../types";

interface Props {
  onSelect: (platform: PlatformKey) => void;
  /**
   * Platforms to omit from the list — the row's own platform plus any
   * platforms already present in the app group (avoids creating duplicates).
   */
  exclude?: readonly PlatformKey[];
  title?: string;
}

export const PlatformMenuButton = ({
  onSelect,
  exclude,
  title = "Duplicate as platform variant",
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

  const available = PLATFORMS.filter((p) => !exclude?.includes(p.key));

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        title={title}
        className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
      >
        <Layers className="w-3.5 h-3.5" />
      </button>
      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            data-platform-menu
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[120] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              Duplicate as
            </div>
            {available.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onSelect(p.key);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
};

export default PlatformMenuButton;
