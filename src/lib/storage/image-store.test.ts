import { describe, expect, it } from "vitest";
import {
  decodeDataUrl,
  hashFromRef,
  isBlobRef,
  refForHash,
  sha256Hex,
} from "./image-store";

// 1x1 transparent PNG.
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

describe("isBlobRef / refForHash / hashFromRef", () => {
  it("round-trips a hash through a ref", () => {
    const ref = refForHash("abc123");
    expect(ref).toBe("pblob:abc123");
    expect(isBlobRef(ref)).toBe(true);
    expect(hashFromRef(ref)).toBe("abc123");
  });

  it("rejects non-refs", () => {
    expect(isBlobRef("data:image/png;base64,xxxx")).toBe(false);
    expect(isBlobRef("https://example.com/a.png")).toBe(false);
    expect(isBlobRef(null)).toBe(false);
    expect(isBlobRef(undefined)).toBe(false);
  });
});

describe("decodeDataUrl", () => {
  it("parses mime and decodes base64 bytes", () => {
    const { mime, bytes } = decodeDataUrl(PNG_DATA_URL);
    expect(mime).toBe("image/png");
    // PNG magic number.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("throws on non-data URLs", () => {
    expect(() => decodeDataUrl("https://x/y.png")).toThrow();
  });
});

describe("sha256Hex (content addressing)", () => {
  it("hashes identical bytes to the same key (dedup) and differs otherwise", async () => {
    const a = decodeDataUrl(PNG_DATA_URL).bytes;
    const b = decodeDataUrl(PNG_DATA_URL).bytes;
    const ha = await sha256Hex(a);
    const hb = await sha256Hex(b);
    expect(ha).toBe(hb);
    expect(ha).toMatch(/^[0-9a-f]{64}$/);

    const different = await sha256Hex(new Uint8Array([1, 2, 3, 4]));
    expect(different).not.toBe(ha);
  });
});
