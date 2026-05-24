/**
 * Color input with a swatch picker, a hex text field, and a "used in other
 * panels" row that lets the user copy a color from another screenshot in one
 * click.
 *
 * Two layers exist because matching colors visually with just a tiny native
 * color picker is fiddly — exposing hex + showing what other panels use makes
 * cross-panel consistency a one-glance / one-click operation.
 */

import { useEffect, useState } from "react";

interface ColorInputProps {
  value: string;
  onChange: (hex: string) => void;
  /** Other colors in the listing — rendered as quick-copy swatches. */
  otherColors?: string[];
  /** Optional label rendered above. */
  label?: string;
}

const HEX_RE = /^#?[0-9a-f]{6}$/i;

const normalizeHex = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return `#${trimmed.replace(/^#/, "").toLowerCase()}`;
};

export const ColorInput = ({
  value,
  onChange,
  otherColors = [],
  label,
}: ColorInputProps) => {
  // Local draft for the hex field so partial typing doesn't fight controlled
  // input — commit on blur / Enter when valid, or revert on Escape.
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = () => {
    const normalized = normalizeHex(draft);
    if (normalized && normalized !== value.toLowerCase()) {
      onChange(normalized);
    } else {
      setDraft(value);
    }
  };

  // Dedup + filter out the currently selected color so we don't show "copy
  // yourself" swatches that look like no-ops.
  const seen = new Set<string>();
  const uniqueOthers = otherColors
    .map((c) => c.toLowerCase())
    .filter((c) => {
      if (c === value.toLowerCase()) return false;
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs text-gray-400">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-8 rounded cursor-pointer bg-transparent border border-white/10"
          aria-label="Color picker"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(value);
              e.currentTarget.blur();
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="flex-1 min-w-0 h-8 px-2 rounded bg-[#0f0f0f] border border-white/10 text-xs text-gray-100 font-mono focus:outline-none focus:border-violet-500/60"
          placeholder="#000000"
        />
      </div>
      {uniqueOthers.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-500 mb-1">From other panels</p>
          <div className="flex flex-wrap gap-1">
            {uniqueOthers.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                title={`Use ${c}`}
                className="group flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/30 bg-[#161616]"
              >
                <span
                  aria-hidden
                  className="w-3 h-3 rounded-sm border border-black/40"
                  style={{ background: c }}
                />
                <span className="text-[10px] text-gray-300 font-mono">{c}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
