/**
 * Slice one image into N equal vertical strips and return each as a dataURL.
 *
 * Used by the "image across panels" style-set mode: we generate one image
 * (typically square) and cut it into per-panel strips that, when shown
 * side-by-side in the canvas, reconstruct the original image visually.
 *
 * Each output strip has aspect = (src.width / N) : src.height. Browsers
 * render screenshot panels as tall portrait rectangles, so the strips are
 * naturally narrow, which is fine — the AI knows to compose a wide scene.
 */

export const sliceImageVertically = async (
  dataUrl: string,
  count: number,
): Promise<string[]> => {
  if (count <= 0) throw new Error("Slice count must be > 0");
  const img = await loadImage(dataUrl);
  const sliceW = Math.floor(img.naturalWidth / count);
  if (sliceW <= 0) throw new Error("Source image is too narrow to slice.");
  const slices: string[] = [];
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = sliceW;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d canvas context.");
    ctx.drawImage(
      img,
      i * sliceW,
      0,
      sliceW,
      img.naturalHeight,
      0,
      0,
      sliceW,
      img.naturalHeight,
    );
    slices.push(canvas.toDataURL("image/png"));
  }
  return slices;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode generated image."));
    img.src = src;
  });

/**
 * Slice one image into N pieces representing a HORIZONTAL BAND across the
 * source. Each slice has its width = sourceWidth / N and its height matches
 * `bandAspect` (sliceWidth / sliceHeight). The band is cropped vertically
 * from the source according to `verticalAnchor`.
 *
 * Used by spanning-overlay mode: we want the overlay to render at a fixed,
 * sensible height (~40% of the panel) rather than the full-height aspect a
 * naive vertical slice would produce (4 strips of a square source become
 * absurdly tall when rendered at 100% panel width).
 */
export const sliceImageBand = async (
  dataUrl: string,
  count: number,
  bandAspect: number,
  verticalAnchor: "top" | "middle" | "bottom",
): Promise<string[]> => {
  if (count <= 0) throw new Error("Slice count must be > 0");
  if (bandAspect <= 0) throw new Error("Band aspect must be > 0");
  const img = await loadImage(dataUrl);
  const sliceW = Math.floor(img.naturalWidth / count);
  if (sliceW <= 0) throw new Error("Source image is too narrow to slice.");
  const desiredBandHeight = Math.min(
    img.naturalHeight,
    Math.round(sliceW / bandAspect),
  );
  const anchorOffset =
    verticalAnchor === "top"
      ? 0
      : verticalAnchor === "bottom"
        ? img.naturalHeight - desiredBandHeight
        : Math.round((img.naturalHeight - desiredBandHeight) / 2);
  const slices: string[] = [];
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = sliceW;
    canvas.height = desiredBandHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d canvas context.");
    ctx.drawImage(
      img,
      i * sliceW,
      anchorOffset,
      sliceW,
      desiredBandHeight,
      0,
      0,
      sliceW,
      desiredBandHeight,
    );
    slices.push(canvas.toDataURL("image/png"));
  }
  return slices;
};
