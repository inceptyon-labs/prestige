/**
 * ScreenContent Component
 *
 * Renders the content displayed on the device screen.
 * Shows either the uploaded screenshot or a placeholder message.
 */

import { useResolvedImage } from "../../lib/storage/image-store";

interface ScreenContentProps {
  /** Image value: a pblob: ref, data: URL, or null. */
  screenshotSrc: string | null;
}

/**
 * Displays the device screen content.
 *
 * @param props - Component props
 * @param props.screenshotSrc - The screenshot image URL or null
 *
 * @example
 * // With an image
 * <ScreenContent screenshotSrc="https://example.com/screenshot.png" />
 *
 * @example
 * // Without an image (shows placeholder)
 * <ScreenContent screenshotSrc={null} />
 */
export const ScreenContent = ({ screenshotSrc }: ScreenContentProps) => {
  const resolved = useResolvedImage(screenshotSrc);
  if (screenshotSrc) {
    return (
      <img
        src={resolved ?? undefined}
        alt="Screenshot"
        decoding="async"
        className="w-full h-full object-fill"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1c1c1e]">
      <span className="text-gray-600 text-[10px]">No image</span>
    </div>
  );
};
