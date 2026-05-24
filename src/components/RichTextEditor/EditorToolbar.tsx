/**
 * EditorToolbar Component
 *
 * Complete toolbar with all formatting controls.
 */

import { Bold, Italic, Underline, Highlighter, Palette } from "lucide-react";
import type { ActiveStyles } from "./types";
import { ICON_SIZE, STYLES } from "./constants";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ColorPicker } from "./ColorPicker";

interface EditorToolbarProps {
  /** Current active formatting styles */
  activeStyles: ActiveStyles;
  /** Current text color */
  textColor: string;
  /** Current highlight color */
  backgroundColor: string;
  /** Execute formatting command */
  onCommand: (command: string, value?: string) => void;
  /** Text color change handler */
  onColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Highlight color change handler */
  onBackgroundColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * EditorToolbar - Complete formatting toolbar
 *
 * Contains all formatting buttons organized into groups:
 * - Text formatting (Bold, Italic, Underline)
 * - Color pickers with custom tooltips
 * - Alignment (Left, Center, Right)
 * - AI Assist (placeholder)
 *
 * @param props - Component props
 *
 * @example
 * <EditorToolbar
 *   activeStyles={activeStyles}
 *   textColor={textColor}
 *   onCommand={execCommand}
 *   onColorChange={handleColorChange}
 * />
 */
export const EditorToolbar = ({
  activeStyles,
  textColor,
  backgroundColor,
  onCommand,
  onColorChange,
  onBackgroundColorChange,
}: EditorToolbarProps) => {
  // Prevent toolbar clicks from stealing focus
  const preventFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className={STYLES.toolbar}>
      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => onCommand("bold")}
        active={activeStyles.bold}
        tooltip="Bold (Ctrl+B)"
        onMouseDown={preventFocus}
      >
        <Bold size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onCommand("italic")}
        active={activeStyles.italic}
        tooltip="Italic (Ctrl+I)"
        onMouseDown={preventFocus}
      >
        <Italic size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onCommand("underline")}
        active={activeStyles.underline}
        tooltip="Underline (Ctrl+U)"
        onMouseDown={preventFocus}
      >
        <Underline size={ICON_SIZE} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Color Pickers */}
      <ColorPicker
        value={textColor}
        onChange={onColorChange}
        onMouseDown={preventFocus}
        tooltip="Text Color"
        icon={<Palette size={ICON_SIZE} />}
      />
      <ColorPicker
        value={backgroundColor}
        onChange={onBackgroundColorChange}
        onMouseDown={preventFocus}
        tooltip="Text Background Color"
        icon={<Highlighter size={ICON_SIZE} />}
      />

    </div>
  );
};
