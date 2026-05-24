/**
 * RightSidebar Component
 *
 * Main sidebar containing position presets, layout, content, appearance, and overlay image controls.
 *
 * Features:
 * - Position presets for quick device positioning
 * - Device layout controls (size, position, rotation, shadow)
 * - Text content editors (headline, subheadline)
 * - Appearance settings (background, colors, fonts)
 * - Overlay image management
 */

import { useEditor } from "../../context/EditorContext";
import { gradientPresets } from "../../constants";
import { DeviceInstancesSection } from "./DeviceInstancesSection";
import { ScreenshotImageSection } from "./ScreenshotImageSection";
import { PositionPresets } from "./PositionPresets";
import { LayoutSection } from "./LayoutSection";
import { ContentSection } from "./ContentSection";
import { AppearanceSection } from "./AppearanceSection";
import { OverlayImagesSection } from "./OverlayImagesSection";
import { ResizeHandle } from "../ResizeHandle";
import { useResizableWidth } from "../../lib/useResizableWidth";
import { STYLES } from "./constants";

/**
 * RightSidebar - Main properties sidebar
 *
 * Provides all editing controls for the active screenshot.
 *
 * @example
 * <RightSidebar />
 */
export const RightSidebar = () => {
  const {
    activeScreenshot,
    activeDevice,
    updateActiveScreenshot,
    headlineFontSize,
    setHeadlineFontSize,
    subheadlineFontSize,
    setSubheadlineFontSize,
    setIsFontPickerOpen,
    fileInputRef,
    handleFileUpload,
    overlayImageInputRef,
    addOverlayImage,
    selectedElement,
    setSelectedElement,
    removeOverlayImage,
    updateOverlayImageSize,
    updateOverlayImageLayer,
    updateOverlayImageRotation,
    updateOverlayImageShadow,
    addDevice,
    selectDevice,
    removeDevice,
    bringDeviceForward,
    sendDeviceBackward,
    bringImageForward,
    sendImageBackward,
  } = useEditor();

  const { width, isResizing, startResize } = useResizableWidth({
    storageKey: "prestige.rightSidebarWidth",
    defaultWidth: 384, // matches the original w-96
    min: 300,
    max: 640,
    edge: "left",
  });

  // Hero panels have no devices; hide every device-specific section in
  // the sidebar so we don't try to dereference an undefined activeDevice.
  // LayoutSection still has useful sliders (headline/subheadline sizing)
  // even when there's no device, so we pass undefined and let it skip
  // device-only controls internally (see LayoutSection).
  const hasDevice = !activeScreenshot.isHero && activeDevice;

  return (
    <aside
      className="shrink-0 border-l border-white/10 bg-[#141414] relative"
      style={{ width }}
    >
      <ResizeHandle side="left" onMouseDown={startResize} isActive={isResizing} />
      <div className="h-full overflow-y-auto">
        <div className={STYLES.content}>
        {hasDevice && (
          <DeviceInstancesSection
            screenshot={activeScreenshot}
            onAddDevice={addDevice}
            onSelectDevice={selectDevice}
            onRemoveDevice={removeDevice}
            onBringForward={bringDeviceForward}
            onSendBackward={sendDeviceBackward}
          />
        )}

        {hasDevice && (
          <ScreenshotImageSection
            device={activeDevice}
            fileInputRef={fileInputRef}
            onFileUpload={handleFileUpload}
          />
        )}

        {hasDevice && (
          <PositionPresets
            device={activeDevice}
            onUpdateDevice={(updates) =>
              updateActiveScreenshot({
                devices: activeScreenshot.devices.map((device) =>
                  device.id === activeDevice.id ? { ...device, ...updates } : device,
                ),
              })
            }
          />
        )}

        {hasDevice && (
          <LayoutSection
            device={activeDevice}
            screenshot={activeScreenshot}
            headlineFontSize={headlineFontSize}
            subheadlineFontSize={subheadlineFontSize}
            onUpdateDevice={(updates) =>
              updateActiveScreenshot({
                devices: activeScreenshot.devices.map((device) =>
                  device.id === activeDevice.id ? { ...device, ...updates } : device,
                ),
              })
            }
            onUpdateScreenshot={updateActiveScreenshot}
            onHeadlineSizeChange={setHeadlineFontSize}
            onSubheadlineSizeChange={setSubheadlineFontSize}
          />
        )}

        <ContentSection
          screenshot={activeScreenshot}
          onUpdateScreenshot={updateActiveScreenshot}
        />

        <AppearanceSection
          screenshot={activeScreenshot}
          gradientPresets={gradientPresets}
          onUpdateScreenshot={updateActiveScreenshot}
          onOpenFontPicker={() => setIsFontPickerOpen(true)}
        />

        <OverlayImagesSection
          screenshot={activeScreenshot}
          selectedElement={selectedElement}
          overlayImageInputRef={overlayImageInputRef}
          onSelectElement={setSelectedElement}
          onAddImage={addOverlayImage}
          onRemoveImage={removeOverlayImage}
          onUpdateSize={updateOverlayImageSize}
          onUpdateLayer={updateOverlayImageLayer}
          onUpdateRotation={updateOverlayImageRotation}
          onUpdateShadow={updateOverlayImageShadow}
          onBringForward={bringImageForward}
          onSendBackward={sendImageBackward}
        />
        </div>
      </div>
    </aside>
  );
};
