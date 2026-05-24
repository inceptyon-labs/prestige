import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { CanvasPreview } from "./CanvasPreview";
import { FontPicker } from "./FontPicker";
import { ExportToast } from "./ExportToast";
import { useEditor } from "../context/EditorContext";
import { useEffect } from "react";

export const EditorLayout = () => {
  const {
    isFontPickerOpen,
    setIsFontPickerOpen,
    exportToast,
    dismissExportToast,
    activeScreenshot,
    updateActiveScreenshot,
    undo,
  } = useEditor();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isUndo =
        (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === "z";
      if (!isUndo) return;
      // Only defer to the browser when a real text input has focus (sidebar
      // fields, font search, etc). Inside the canvas's contentEditable
      // headline/subheadline we still want our editor-level undo, since
      // React + contentEditable doesn't get native undo right anyway.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <LeftSidebar />
        <CanvasPreview />
        <RightSidebar />
        <FontPicker
          isOpen={isFontPickerOpen}
          onClose={() => setIsFontPickerOpen(false)}
          selectedFontFamily={activeScreenshot.fontFamily}
          onSelect={(fontFamily: string) =>
            updateActiveScreenshot({ fontFamily })
          }
        />
        <ExportToast toast={exportToast} onDismiss={dismissExportToast} />
      </div>
    </div>
  );
};
