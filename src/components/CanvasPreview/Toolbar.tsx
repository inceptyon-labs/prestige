/**
 * Toolbar Component
 *
 * Top toolbar for the canvas preview area with screenshot management controls.
 * Has two ways to add a screenshot:
 *   - "Add Screenshot" — blank, same as before
 *   - "✨ Generate" — opens a modal that asks the AI to scaffold a screenshot
 *     from a one-line idea + brand context.
 */

import { useState } from "react";
import { Crown, Layers, Palette, Plus, Sparkles } from "lucide-react";
import { GenerateScreenshotModal } from "../GenerateScreenshotModal";
import { GenerateListingModal } from "../GenerateListingModal";
import { GenerateHeroModal } from "../GenerateHeroModal";
import { StyleSetModal } from "../StyleSetModal";

interface ToolbarProps {
  onAddScreenshot: () => void;
  screenshotCount: number;
}

export const Toolbar = ({ onAddScreenshot, screenshotCount }: ToolbarProps) => {
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isListingOpen, setIsListingOpen] = useState(false);
  const [isHeroOpen, setIsHeroOpen] = useState(false);
  const [isStyleSetOpen, setIsStyleSetOpen] = useState(false);

  // shrink-0 + whitespace-nowrap on each button keeps them from being
  // compressed by flex when the canvas area gets narrow; overflow-x-auto on
  // the row lets the user scroll the button bar instead.
  const btnBase =
    "shrink-0 whitespace-nowrap flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors";

  return (
    <div className="border-b border-white/10 bg-[#141414] flex items-center px-4 pt-4 pb-3 gap-4">
      <div className="flex items-center gap-2 overflow-x-auto min-w-0">
        <button
          onClick={onAddScreenshot}
          className={`${btnBase} bg-white hover:bg-neutral-200 text-black`}
        >
          <Plus className="w-4 h-4" />
          Add Screenshot
        </button>
        <button
          onClick={() => setIsGenerateOpen(true)}
          title="Generate one screenshot from brand context"
          className={`${btnBase} bg-violet-600 hover:bg-violet-500 text-white`}
        >
          <Sparkles className="w-4 h-4" />
          Generate One
        </button>
        <button
          onClick={() => setIsListingOpen(true)}
          title="Generate a full coherent listing (3–10 panels) in one shot"
          className={`${btnBase} bg-violet-700 hover:bg-violet-600 text-white`}
        >
          <Layers className="w-4 h-4" />
          Generate Listing
        </button>
        <button
          onClick={() => setIsHeroOpen(true)}
          title="Generate a hero cover panel — no device, brand-derived text + AI background"
          className={`${btnBase} bg-amber-700 hover:bg-amber-600 text-white`}
        >
          <Crown className="w-4 h-4" />
          Generate Hero
        </button>
        <button
          onClick={() => setIsStyleSetOpen(true)}
          disabled={screenshotCount === 0}
          title="Style the whole set with AI — coherent themes, spanning image, or per-panel accents"
          className={`${btnBase} bg-fuchsia-700 hover:bg-fuchsia-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white`}
        >
          <Palette className="w-4 h-4" />
          Style Set
        </button>
      </div>
      <GenerateScreenshotModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
      />
      <GenerateListingModal
        isOpen={isListingOpen}
        onClose={() => setIsListingOpen(false)}
      />
      <GenerateHeroModal
        isOpen={isHeroOpen}
        onClose={() => setIsHeroOpen(false)}
      />
      <StyleSetModal
        isOpen={isStyleSetOpen}
        onClose={() => setIsStyleSetOpen(false)}
      />
    </div>
  );
};
