/**
 * LeftSidebar Component
 *
 * Main sidebar containing project switcher, device selection and export options.
 *
 * Features:
 * - Project management (create, switch, rename, delete)
 * - Device model selection
 * - Device color selection
 * - Export size selection
 * - Export all screenshots button
 */

import { useState } from "react";
import { ChevronsLeft, ChevronsRight, Settings } from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import { devices, exportSizes } from "../../constants";
import { SidebarHeader } from "./SidebarHeader";
import { DeviceSection } from "./DeviceSection";
import { ExportSection } from "./ExportSection";
import { ProjectSwitcher, SaveStatus, ProjectActions } from "../ProjectSwitcher";
import { BrandContextSection } from "./BrandContextSection";
import { SettingsModal } from "../SettingsModal";
import { ResizeHandle } from "../ResizeHandle";
import { useResizableWidth } from "../../lib/useResizableWidth";
import { STYLES } from "./constants";

/**
 * LeftSidebar - Main settings sidebar
 *
 * Provides controls for project management, device selection,
 * color options, and export functionality.
 *
 * @example
 * <LeftSidebar />
 */
export const LeftSidebar = () => {
  const {
    selectedDeviceId,
    setSelectedDeviceId,
    selectedColorId,
    setSelectedColorId,
    selectedDevice,
    exportSizeId,
    setExportSizeId,
    handleExport,
    screenshots,
  } = useEditor();

  // Handle device selection with default color
  const handleDeviceSelect = (deviceId: string, defaultColorId: string) => {
    setSelectedDeviceId(deviceId);
    setSelectedColorId(defaultColorId);
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { width, isResizing, startResize } = useResizableWidth({
    storageKey: "prestige.leftSidebarWidth",
    defaultWidth: 288, // matches the original w-72
    min: 220,
    max: 520,
    edge: "right",
  });

  if (isCollapsed) {
    return (
      <>
        <aside className="w-8 shrink-0 border-r border-white/10 bg-[#141414] flex flex-col items-center pt-3 gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            title="Expand sidebar"
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 hover:text-white"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            className="p-1.5 rounded hover:bg-white/10 text-zinc-300 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </button>
        </aside>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </>
    );
  }

  return (
    <aside
      className="shrink-0 border-r border-white/10 bg-[#141414] flex flex-col relative"
      style={{ width }}
    >
      <ResizeHandle side="right" onMouseDown={startResize} isActive={isResizing} />
      <div className="relative">
        <SidebarHeader />
        <div className="absolute top-3 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse sidebar"
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Project Switcher + persistence controls */}
      <div className="relative px-4 pb-4 border-b border-zinc-800">
        <ProjectSwitcher />
        <div className="mt-2 flex items-center justify-between gap-2">
          <SaveStatus />
        </div>
        <ProjectActions />
      </div>

      <BrandContextSection />

      <div className={STYLES.content}>
        <DeviceSection
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          selectedColorId={selectedColorId}
          selectedDevice={selectedDevice}
          onDeviceSelect={handleDeviceSelect}
          onColorSelect={setSelectedColorId}
        />

        <ExportSection
          exportSizes={exportSizes}
          selectedSizeId={exportSizeId}
          screenshotCount={screenshots.length}
          onSizeSelect={setExportSizeId}
          onExport={handleExport}
        />
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </aside>
  );
};
