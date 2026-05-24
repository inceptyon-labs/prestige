/**
 * BackgroundPicker Component
 *
 * Background mode and color/gradient/image selection. AI suggestions for
 * background colors live under the unified Appearance ✨ Theme button
 * (see AppearanceSection). The "Image" mode is filled by the AI image
 * generation modal — there's no manual upload here, since we already have
 * device screenshot uploads + overlay image uploads elsewhere.
 */

import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { Screenshot, GradientPreset } from "../../types";
import { STYLES } from "./constants";
import { GenerateImageModal } from "../GenerateImageModal";
import { ColorInput } from "./ColorInput";
import { useEditor } from "../../context/EditorContext";

interface BackgroundPickerProps {
  screenshot: Screenshot;
  gradientPresets: GradientPreset[];
  onUpdateScreenshot: (updates: Partial<Screenshot>) => void;
}

export const BackgroundPicker = ({
  screenshot,
  gradientPresets,
  onUpdateScreenshot,
}: BackgroundPickerProps) => {
  const { clearBackgroundImage, screenshots } = useEditor();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Collect solid background colors used by the other screenshots so the user
  // can match a tint across panels with one click. Gradient/image panels still
  // carry a backgroundColor (the image's tint), so we include those too.
  const otherColors = useMemo(
    () =>
      screenshots
        .filter((s) => s.id !== screenshot.id)
        .map((s) => s.backgroundColor)
        .filter((c): c is string => typeof c === "string" && c.length > 0),
    [screenshots, screenshot.id],
  );

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">Background</label>
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => onUpdateScreenshot({ backgroundMode: "solid" })}
            className={`${STYLES.modeButton} ${
              screenshot.backgroundMode === "solid"
                ? STYLES.modeButtonActive
                : STYLES.modeButtonInactive
            }`}
          >
            Solid
          </button>
          <button
            onClick={() => onUpdateScreenshot({ backgroundMode: "gradient" })}
            className={`${STYLES.modeButton} ${
              screenshot.backgroundMode === "gradient"
                ? STYLES.modeButtonActive
                : STYLES.modeButtonInactive
            }`}
          >
            Gradient
          </button>
          <button
            onClick={() => {
              // Switching INTO image mode without an image yet leaves the
              // canvas falling back to backgroundColor. Open the AI modal
              // immediately so the user can fill it.
              onUpdateScreenshot({ backgroundMode: "image" });
              if (!screenshot.backgroundImageSrc) setIsImageModalOpen(true);
            }}
            className={`${STYLES.modeButton} ${
              screenshot.backgroundMode === "image"
                ? STYLES.modeButtonActive
                : STYLES.modeButtonInactive
            }`}
          >
            Image
          </button>
        </div>

        {screenshot.backgroundMode === "solid" ? (
          <ColorInput
            value={screenshot.backgroundColor}
            onChange={(hex) => onUpdateScreenshot({ backgroundColor: hex })}
            otherColors={otherColors}
          />
        ) : screenshot.backgroundMode === "gradient" ? (
          <div className="grid grid-cols-3 gap-1">
            {gradientPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() =>
                  onUpdateScreenshot({
                    gradientPresetId: preset.id,
                    customGradient: null,
                  })
                }
                className={`${STYLES.gradientButton} ${
                  screenshot.gradientPresetId === preset.id &&
                  !screenshot.customGradient
                    ? STYLES.gradientButtonActive
                    : ""
                }`}
                style={{
                  background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {screenshot.backgroundImageSrc && (
              <div className="relative rounded-md overflow-hidden border border-white/10">
                <img
                  src={screenshot.backgroundImageSrc}
                  alt="Generated background"
                  className="w-full h-24 object-cover"
                  style={{ opacity: screenshot.backgroundImageOpacity ?? 1 }}
                />
                <button
                  type="button"
                  onClick={clearBackgroundImage}
                  title="Remove background image"
                  className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/80 text-white rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {screenshot.backgroundImageSrc && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-xs text-gray-400">Opacity</label>
                  <span className="text-[11px] text-gray-300">
                    {Math.round(
                      (screenshot.backgroundImageOpacity ?? 1) * 100,
                    )}
                    %
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={screenshot.backgroundImageOpacity ?? 1}
                  onChange={(e) =>
                    onUpdateScreenshot({
                      backgroundImageOpacity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-violet-500"
                />
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Fades the image toward the tint color below so headlines
                  stay readable.
                </p>
              </div>
            )}
            {screenshot.backgroundImageSrc && (
              <ColorInput
                label="Tint color"
                value={screenshot.backgroundColor}
                onChange={(hex) => onUpdateScreenshot({ backgroundColor: hex })}
                otherColors={otherColors}
              />
            )}
            <button
              type="button"
              onClick={() => setIsImageModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs py-1.5 rounded-md transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {screenshot.backgroundImageSrc
                ? "Regenerate image"
                : "Generate image"}
            </button>
          </div>
        )}
      </div>
      <GenerateImageModal
        isOpen={isImageModalOpen}
        target="background"
        onClose={() => setIsImageModalOpen(false)}
      />
    </div>
  );
};
