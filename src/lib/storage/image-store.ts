/**
 * Content-addressed image store.
 *
 * Images used to be inlined into project JSON as base64 `data:` URLs, which
 * made every project file ~12 MB and ballooned startup memory. Now images live
 * once in a blob store keyed by a hash of their bytes, and project fields hold a
 * short `pblob:<hash>` reference instead. Identical images (e.g. the same
 * screens copied across platform/locale variants) collapse to one blob.
 *
 * A field value is therefore one of:
 *   - `pblob:<sha256hex>`  — persisted reference into the blob store
 *   - `data:...`           — freshly added in-session, not yet externalized
 *   - `http(s):...`        — external URL (passed through)
 *   - null / undefined     — no image
 *
 * Two seams use this module: the save path externalizes `data:` → `pblob:`
 * (see externalizeProject), and render/export sites resolve a ref back to a
 * usable object URL (see resolve / useResolvedImage).
 */

import { useEffect, useState } from "react";
import type { Project } from "../../types";
import {
  deleteBlob,
  getBlob,
  hasBlob,
  listBlobHashes,
  listProjects,
  listSnapshots,
  putBlob,
} from "./db";

const REF_PREFIX = "pblob:";

export const isBlobRef = (s: string | null | undefined): s is string =>
  typeof s === "string" && s.startsWith(REF_PREFIX);

export const refForHash = (hash: string): string => `${REF_PREFIX}${hash}`;
export const hashFromRef = (ref: string): string => ref.slice(REF_PREFIX.length);

const isDataUrl = (s: string): boolean => s.startsWith("data:");

// --- byte / hash helpers (exported for tests) ------------------------------

export interface DecodedDataUrl {
  mime: string;
  bytes: Uint8Array;
}

export const decodeDataUrl = (dataUrl: string): DecodedDataUrl => {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma === -1) {
    throw new Error("Not a data URL");
  }
  const header = dataUrl.slice(5, comma); // strip "data:"
  const mime = header.split(";")[0] || "image/png";
  const isBase64 = /;base64/i.test(header);
  const data = dataUrl.slice(comma + 1);
  if (isBase64) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(data)) };
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// --- ingest (data: -> pblob: ref) ------------------------------------------

// Per-hash in-flight writes so two identical images ingesting concurrently
// (e.g. the same screen across variants in one Promise.all save) don't both see
// hasBlob()===false and race a write to the same blob path.
const inFlightWrites = new Map<string, Promise<void>>();

/**
 * Store an image's bytes (from a data URL) in the blob store and return its
 * `pblob:<hash>` reference. Idempotent: identical bytes hash to the same key,
 * so a re-ingest is a no-op write. Non-data inputs (already a ref, or an
 * http/blob URL) are returned unchanged.
 */
export const ingest = async (value: string): Promise<string> => {
  if (isBlobRef(value)) return value;
  if (!isDataUrl(value)) return value;
  const { mime, bytes } = decodeDataUrl(value);
  const hash = await sha256Hex(bytes);
  const ref = refForHash(hash);

  const existing = inFlightWrites.get(hash);
  if (existing) {
    await existing;
    return ref;
  }
  const job = (async () => {
    if (!(await hasBlob(hash))) {
      await putBlob(hash, new Blob([bytes as BlobPart], { type: mime }));
    }
  })();
  inFlightWrites.set(hash, job);
  try {
    await job;
  } finally {
    inFlightWrites.delete(hash);
  }
  return ref;
};

// --- resolve (pblob: ref -> object URL) ------------------------------------

const MAX_CACHED_URLS = 64;
// hash -> object URL, in LRU order (oldest first).
const urlCache = new Map<string, string>();

const cachedUrl = (hash: string): string | null => {
  const url = urlCache.get(hash);
  if (url === undefined) return null;
  // touch: move to most-recent.
  urlCache.delete(hash);
  urlCache.set(hash, url);
  return url;
};

const cacheUrl = (hash: string, url: string): void => {
  urlCache.set(hash, url);
  while (urlCache.size > MAX_CACHED_URLS) {
    const oldest = urlCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const stale = urlCache.get(oldest);
    urlCache.delete(oldest);
    if (stale) URL.revokeObjectURL(stale);
  }
};

/** Synchronous cache lookup for a ref; null if not resolved yet. */
export const resolvedSync = (ref: string | null | undefined): string | null => {
  if (!ref) return null;
  if (!isBlobRef(ref)) return ref;
  return cachedUrl(hashFromRef(ref));
};

/**
 * Resolve a field value to a URL usable in <img>/canvas/CSS. Passes through
 * data:/http; turns a `pblob:` ref into a cached object URL. Returns null if the
 * blob is missing.
 */
export const resolve = async (
  ref: string | null | undefined,
): Promise<string | null> => {
  if (!ref) return null;
  if (!isBlobRef(ref)) return ref;
  const hash = hashFromRef(ref);
  const cached = cachedUrl(hash);
  if (cached) return cached;
  const blob = await getBlob(hash);
  if (!blob) return null;
  const url = URL.createObjectURL(await ensureTyped(blob));
  cacheUrl(hash, url);
  return url;
};

/** Sniff an image MIME from magic bytes (PNG/JPEG/WebP/GIF), else null. */
const sniffMime = (b: Uint8Array): string | null => {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  if (b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return "image/gif";
  return null;
};

/**
 * FS blobs come back typeless (the filesystem stores raw bytes). Re-wrap with a
 * sniffed image MIME so object URLs and data URLs carry a correct type. IDB
 * blobs keep their ingest-time type and pass through.
 */
const ensureTyped = async (blob: Blob): Promise<Blob> => {
  if (blob.type) return blob;
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const mime = sniffMime(head);
  return mime ? new Blob([blob], { type: mime }) : blob;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });

/**
 * Resolve a field value to a base64 `data:` URL. Used where a self-contained
 * data URL is required rather than an ephemeral object URL: project
 * export/sharing (the file must survive on another machine) and the vision
 * pipeline (materializes a data URL to a temp file). Passes through existing
 * data:/http values; returns null if a referenced blob is missing.
 */
export const resolveToDataUrl = async (
  ref: string | null | undefined,
): Promise<string | null> => {
  if (!ref) return null;
  if (!isBlobRef(ref)) return ref;
  const blob = await getBlob(hashFromRef(ref));
  if (!blob) return null;
  return blobToDataUrl(await ensureTyped(blob));
};

/**
 * React hook: resolve a ref to a usable URL, re-rendering when ready. Returns
 * the cached URL synchronously when available, otherwise null until resolved.
 */
export const useResolvedImage = (
  ref: string | null | undefined,
): string | null => {
  const [url, setUrl] = useState<string | null>(() => resolvedSync(ref));

  useEffect(() => {
    let alive = true;
    if (!ref) {
      setUrl(null);
      return;
    }
    if (!isBlobRef(ref)) {
      setUrl(ref);
      return;
    }
    const sync = resolvedSync(ref);
    if (sync) {
      setUrl(sync);
      return;
    }
    setUrl(null);
    void resolve(ref).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [ref]);

  return url;
};

// --- externalize a project (data: -> refs) ---------------------------------

const externalizeField = async (
  value: string | null | undefined,
): Promise<string | null | undefined> => {
  if (typeof value !== "string" || !isDataUrl(value)) return value;
  try {
    return await ingest(value);
  } catch (err) {
    // A malformed data URL must not crash a save or the one-time migration.
    // Leave it inline; it just won't be externalized.
    console.warn("[image-store] ingest failed, keeping image inline:", err);
    return value;
  }
};

const inlineField = async (
  value: string | null | undefined,
): Promise<string | null | undefined> =>
  isBlobRef(value ?? undefined) ? ((await resolveToDataUrl(value)) ?? value) : value;

/**
 * Return a clone of the project with every inline `data:` image replaced by a
 * `pblob:` ref (storing the blob as a side effect). Refs and empty fields are
 * left untouched. Used by the save path and the one-time migration.
 */
export const externalizeProject = async (
  project: Project,
): Promise<Project> => {
  const screenshots = await Promise.all(
    project.screenshots.map(async (s) => ({
      ...s,
      backgroundImageSrc: (await externalizeField(s.backgroundImageSrc)) as
        | string
        | undefined,
      devices: await Promise.all(
        s.devices.map(async (d) => ({
          ...d,
          screenshotSrc: (await externalizeField(d.screenshotSrc)) as
            | string
            | null,
        })),
      ),
      overlayImages: await Promise.all(
        s.overlayImages.map(async (img) => ({
          ...img,
          src: (await externalizeField(img.src)) as string,
        })),
      ),
    })),
  );
  return { ...project, screenshots };
};

/**
 * Inverse of externalizeProject: return a clone with every `pblob:` ref
 * resolved back to a self-contained base64 data URL. Used when exporting a
 * project to a portable .prestige.json so the file works on another machine
 * (where the blob store doesn't exist). Refs whose blob is missing are left
 * as-is.
 */
export const inlineProject = async (project: Project): Promise<Project> => {
  const screenshots = await Promise.all(
    project.screenshots.map(async (s) => ({
      ...s,
      backgroundImageSrc: (await inlineField(s.backgroundImageSrc)) as
        | string
        | undefined,
      devices: await Promise.all(
        s.devices.map(async (d) => ({
          ...d,
          screenshotSrc: (await inlineField(d.screenshotSrc)) as string | null,
        })),
      ),
      overlayImages: await Promise.all(
        s.overlayImages.map(async (img) => ({
          ...img,
          src: (await inlineField(img.src)) as string,
        })),
      ),
    })),
  );
  return { ...project, screenshots };
};

/** Whether a project still holds any inline data: image (i.e. needs migration). */
export const hasInlineImages = (project: Project): boolean =>
  project.screenshots.some(
    (s) =>
      (typeof s.backgroundImageSrc === "string" &&
        isDataUrl(s.backgroundImageSrc)) ||
      s.devices.some(
        (d) =>
          typeof d.screenshotSrc === "string" && isDataUrl(d.screenshotSrc),
      ) ||
      s.overlayImages.some((img) => isDataUrl(img.src)),
  );

// --- GC --------------------------------------------------------------------

export const collectRefs = (project: Project): string[] => {
  const refs: string[] = [];
  for (const s of project.screenshots) {
    if (isBlobRef(s.backgroundImageSrc)) refs.push(s.backgroundImageSrc!);
    for (const d of s.devices) {
      if (isBlobRef(d.screenshotSrc)) refs.push(d.screenshotSrc!);
    }
    for (const img of s.overlayImages) {
      if (isBlobRef(img.src)) refs.push(img.src);
    }
  }
  return refs;
};

/**
 * Delete blobs no longer referenced by any persisted project or snapshot.
 * Pass the current in-memory projects as `liveRoots` so blobs referenced only
 * by not-yet-saved state (e.g. a just-duplicated project, or a paste) aren't
 * collected out from under it.
 */
export const sweepBlobs = async (
  liveRoots: Project[] = [],
): Promise<number> => {
  const projects = await listProjects();
  const referenced = new Set<string>();
  const mark = (p: Project) => {
    for (const ref of collectRefs(p)) referenced.add(hashFromRef(ref));
  };
  for (const p of liveRoots) mark(p);
  for (const p of projects) {
    mark(p);
    const snaps = await listSnapshots(p.id);
    for (const snap of snaps) mark(snap.project);
  }
  const all = await listBlobHashes();
  let removed = 0;
  for (const hash of all) {
    if (!referenced.has(hash)) {
      await deleteBlob(hash);
      removed++;
    }
  }
  return removed;
};
