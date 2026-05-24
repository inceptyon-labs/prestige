/**
 * AppearanceSection Component
 *
 * All visual styling — background, text color, font — plus a single ✨ button
 * that asks the AI for a *coherent theme* (font + background + text color
 * picked together to match the brand). One preview card; click to apply
 * everything at once.
 */

import { AlertCircle, ChevronDown, Check, X } from "lucide-react";
import type { Screenshot, GradientPreset } from "../../types";
import { SidebarSection } from "./SidebarSection";
import { BackgroundPicker } from "./BackgroundPicker";
import { STYLES } from "./constants";
import { SuggestButton } from "../AISuggest";
import { useModelLabel } from "../../lib/ai/use-model-label";
import { useEditor } from "../../context/EditorContext";

interface AppearanceSectionProps {
  screenshot: Screenshot;
  gradientPresets: GradientPreset[];
  onUpdateScreenshot: (updates: Partial<Screenshot>) => void;
  onOpenFontPicker: () => void;
}

export const AppearanceSection = ({
  screenshot,
  gradientPresets,
  onUpdateScreenshot,
  onOpenFontPicker,
}: AppearanceSectionProps) => {
  const {
    isGeneratingTheme,
    themeSuggestion,
    themeError,
    generateThemeSuggestion,
    applyThemeSuggestion,
    dismissThemeSuggestion,
  } = useEditor();
  const modelLabel = useModelLabel("default");

  const previewBg = themeSuggestion
    ? themeSuggestion.backgroundMode === "gradient" &&
      themeSuggestion.customGradient
      ? `linear-gradient(180deg, ${themeSuggestion.customGradient.from}, ${themeSuggestion.customGradient.to})`
      : themeSuggestion.backgroundColor
    : null;

  return (
    <SidebarSection title="Appearance">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            Font · Background · Text color
          </span>
          <SuggestButton
            onClick={() => void generateThemeSuggestion()}
            isLoading={isGeneratingTheme}
            label="Suggest theme"
            caption={modelLabel}
          />
        </div>

        {themeError && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-wrap break-words flex-1">
              {themeError}
            </span>
            <button
              type="button"
              onClick={dismissThemeSuggestion}
              className="text-zinc-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {themeSuggestion && previewBg && (
          <button
            type="button"
            onClick={applyThemeSuggestion}
            className="group w-full text-left rounded border border-zinc-700 hover:border-violet-500 transition-colors overflow-hidden"
          >
            <div
              className="h-14 flex items-center justify-center px-2"
              style={{ background: previewBg }}
            >
              <span
                className="text-base font-semibold truncate drop-shadow"
                style={{
                  fontFamily: `'${themeSuggestion.fontFamily}', sans-serif`,
                  color: themeSuggestion.textColor,
                }}
              >
                {themeSuggestion.fontFamily}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 bg-zinc-900 text-[11px] text-zinc-400">
              <span>
                {themeSuggestion.backgroundMode === "gradient"
                  ? "gradient"
                  : themeSuggestion.backgroundColor}{" "}
                · text {themeSuggestion.textColor}
              </span>
              <Check className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400" />
            </div>
          </button>
        )}

        <BackgroundPicker
          screenshot={screenshot}
          gradientPresets={gradientPresets}
          onUpdateScreenshot={onUpdateScreenshot}
        />

        <div>
          <label className="block text-xs text-gray-400 mb-1">Text Color</label>
          <input
            type="color"
            value={screenshot.textColor}
            onChange={(e) => onUpdateScreenshot({ textColor: e.target.value })}
            className={STYLES.colorInput}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Font Style</label>
          <button onClick={onOpenFontPicker} className={STYLES.dropdownButton}>
            <span style={{ fontFamily: `'${screenshot.fontFamily}', sans-serif` }}>
              {screenshot.fontFamily}
            </span>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
        </div>
      </div>
    </SidebarSection>
  );
};
