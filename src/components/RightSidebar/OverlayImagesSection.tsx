/**
 * OverlayImagesSection Component
 *
 * Overlay images management section.
 */

import { useState, type RefObject } from "react";
import { Sparkles } from "lucide-react";
import type { Screenshot, ShadowConfig } from "../../types";
import { SidebarSection } from "./SidebarSection";
import { OverlayImageItem } from "./OverlayImageItem";
import { OverlayImageProperties } from "./OverlayImageProperties";
import { STYLES } from "./constants";
import type { SelectedElement } from "./types";
import { GenerateImageModal } from "../GenerateImageModal";

interface OverlayImagesSectionProps {
  /** Active screenshot data */
  screenshot: Screenshot;
  /** Currently selected element */
  selectedElement: SelectedElement | null;
  /** Overlay image input ref */
  overlayImageInputRef: RefObject<HTMLInputElement | null>;
  /** Set selected element handler */
  onSelectElement: (element: SelectedElement | null) => void;
  /** Add overlay image handler */
  onAddImage: (file: File) => void;
  /** Remove overlay image handler */
  onRemoveImage: (id: string) => void;
  /** Update image size handler */
  onUpdateSize: (id: string, size: number) => void;
  /** Update image layer handler */
  onUpdateLayer: (id: string, layer: "behind" | "front") => void;
  /** Update image rotation handler */
  onUpdateRotation: (id: string, rotation: number) => void;
  /** Update image shadow handler */
  onUpdateShadow: (id: string, shadow: Partial<ShadowConfig>) => void;
  /** Bring image forward handler */
  onBringForward: (id: string) => void;
  /** Send image backward handler */
  onSendBackward: (id: string) => void;
}

/**
 * OverlayImagesSection - Overlay images management
 *
 * Add, remove, and configure overlay images.
 *
 * @param props - Component props
 */
export const OverlayImagesSection = ({
  screenshot,
  selectedElement,
  overlayImageInputRef,
  onSelectElement,
  onAddImage,
  onRemoveImage,
  onUpdateSize,
  onUpdateLayer,
  onUpdateRotation,
  onUpdateShadow,
  onBringForward,
  onSendBackward,
}: OverlayImagesSectionProps) => {
  const selectedImage =
    selectedElement?.type === "image" &&
    selectedElement.screenshotId === screenshot.id &&
    selectedElement.id
      ? screenshot.overlayImages.find((img) => img.id === selectedElement.id)
      : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddImage(file);
    e.target.value = "";
  };

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  return (
    <SidebarSection title="Overlay Images">
      <div className="space-y-2">
        <input
          ref={overlayImageInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            onClick={() => overlayImageInputRef.current?.click()}
            className={`${STYLES.uploadButton} flex-1`}
          >
            + Add Image
          </button>
          <button
            onClick={() => setIsAIModalOpen(true)}
            title="Generate an overlay image with AI"
            className="px-3 inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm py-2 rounded-md transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate
          </button>
        </div>

        {screenshot.overlayImages.length > 0 && (
          <div className="space-y-2 mt-3">
            {screenshot.overlayImages.map((img, index) => (
              <OverlayImageItem
                key={img.id}
                image={img}
                index={index}
                totalCount={screenshot.overlayImages.length}
                isSelected={
                  selectedElement?.type === "image" &&
                  selectedElement?.screenshotId === screenshot.id &&
                  selectedElement?.id === img.id
                }
                onSelect={() =>
                  onSelectElement({
                    type: "image",
                    id: img.id,
                    screenshotId: screenshot.id,
                  })
                }
                onRemove={() => onRemoveImage(img.id)}
                onMoveForward={() => onBringForward(img.id)}
                onMoveBackward={() => onSendBackward(img.id)}
              />
            ))}

            {selectedImage && (
              <OverlayImageProperties
                image={selectedImage}
                onSizeChange={(size) => onUpdateSize(selectedImage.id, size)}
                onRotationChange={(rotation) =>
                  onUpdateRotation(selectedImage.id, rotation)
                }
                onLayerChange={(layer) =>
                  onUpdateLayer(selectedImage.id, layer)
                }
                onShadowToggle={() =>
                  onUpdateShadow(selectedImage.id, {
                    enabled: !selectedImage.shadow?.enabled,
                  })
                }
                onShadowColorChange={(color) =>
                  onUpdateShadow(selectedImage.id, { color })
                }
                onShadowBlurChange={(blur) =>
                  onUpdateShadow(selectedImage.id, { blur })
                }
                onShadowOffsetYChange={(offsetY) =>
                  onUpdateShadow(selectedImage.id, { offsetY })
                }
              />
            )}
          </div>
        )}
      </div>
      <GenerateImageModal
        isOpen={isAIModalOpen}
        target="overlay"
        onClose={() => setIsAIModalOpen(false)}
      />
    </SidebarSection>
  );
};
