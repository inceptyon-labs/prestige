/**
 * React hook bridging the editor state with the IndexedDB layer.
 *
 * - Hydrates projects + activeProjectId on mount (async, returns a status).
 * - Debounced auto-save of projects & active id whenever they change.
 * - Flushes synchronously-ish on beforeunload.
 * - Exposes lastSaved / isSaving so the UI can show a status indicator.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../types";
import {
  getMeta,
  listProjects,
  listSnapshots,
  migrateFromLocalStorage,
  putProject,
  putSnapshot,
  saveEditorState,
  setMeta,
} from "./storage/db";
import { externalizeProject, hasInlineImages } from "./storage/image-store";

const AUTO_SAVE_DELAY_MS = 800;
const BLOB_MIGRATION_FLAG = "migrated:blobs-v1";

/**
 * One-time: pull every project's (and snapshot's) inline base64 images out into
 * the content-addressed blob store, rewriting them to short pblob: refs. Runs on
 * first launch after the blob-store update. Returns the externalized projects so
 * the in-memory hydrate uses refs immediately (freeing the base64 from memory).
 */
const migrateInlineImagesToBlobs = async (
  projectList: Project[],
): Promise<Project[]> => {
  const already = await getMeta<boolean>(BLOB_MIGRATION_FLAG);
  if (already) return projectList;

  const out: Project[] = [];
  for (const p of projectList) {
    const ext = hasInlineImages(p) ? await externalizeProject(p) : p;
    if (ext !== p) await putProject(ext);
    out.push(ext);
    // Snapshots aren't part of the editor state load; migrate them in place.
    const snaps = await listSnapshots(p.id);
    for (const snap of snaps) {
      if (hasInlineImages(snap.project)) {
        await putSnapshot({
          ...snap,
          project: await externalizeProject(snap.project),
        });
      }
    }
  }
  await setMeta(BLOB_MIGRATION_FLAG, true);
  return out;
};

export interface HydratedState {
  projects: Project[];
  activeProjectId?: string;
}

export interface UseEditorStorageResult {
  /** True while we're still loading from IndexedDB on mount. */
  isHydrating: boolean;
  /** Hydrated state, available once isHydrating is false. May be null if first run. */
  hydrated: HydratedState | null;
  /** True while a debounced save is in flight. */
  isSaving: boolean;
  /** Timestamp of last successful save (ms). 0 if never. */
  lastSaved: number;
  /** Most recent save error message, or null. */
  saveError: string | null;
  /** Force an immediate save (used for explicit "save now"). */
  flush: () => Promise<void>;
  /**
   * Cancel any debounced save without writing. Use before destructive ops
   * (e.g. resetEditor) so a queued save can't clobber the cleared state.
   */
  cancelPending: () => void;
}

export const useEditorStorage = (
  projects: Project[],
  activeProjectId: string,
  enabled: boolean,
): UseEditorStorageResult => {
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrated, setHydrated] = useState<HydratedState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProjectsRef = useRef<Project[]>(projects);
  const pendingActiveIdRef = useRef<string>(activeProjectId);
  // Serialize all writes through this promise so that debounce + flush +
  // beforeunload can't race each other and interleave transactions.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  // Dirty tracking: maps each persisted project id to the in-memory object
  // reference that was last saved. `updateProjectState` only clones the active
  // project on edit, so a reference mismatch precisely identifies which
  // projects changed — we then re-serialize only those, not all 14.
  const lastSavedRef = useRef<Map<string, Project>>(new Map());
  const lastSavedActiveIdRef = useRef<string | null>(null);

  pendingProjectsRef.current = projects;
  pendingActiveIdRef.current = activeProjectId;

  // --- Hydration ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await migrateFromLocalStorage();
        const [projectList, activeId] = await Promise.all([
          listProjects(),
          getMeta<string>("activeProjectId"),
        ]);
        if (cancelled) return;
        const projects = await migrateInlineImagesToBlobs(projectList);
        if (cancelled) return;
        setHydrated({
          projects,
          activeProjectId: activeId,
        });
      } catch (err) {
        console.error("Failed to hydrate editor state from IndexedDB:", err);
        if (!cancelled) setHydrated({ projects: [] });
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Save core ------------------------------------------------------------
  // All saves are queued behind saveChainRef so they run sequentially, and
  // each save is one atomic IndexedDB transaction (projects + activeId), so
  // a tab close mid-write can't leave the stored state half-applied.
  const doSave = useCallback(async (): Promise<void> => {
    const next = saveChainRef.current.then(async () => {
      const projectsToSave = pendingProjectsRef.current;
      const activeIdToSave = pendingActiveIdRef.current;

      // Only persist projects whose in-memory reference changed since the last
      // save (plus the active-id if it changed). saveEditorState is upsert-only,
      // so writing just the dirty subset is correct; deletions go through
      // deleteProject directly.
      const dirty = projectsToSave.filter(
        (p) => lastSavedRef.current.get(p.id) !== p,
      );
      const activeIdChanged = lastSavedActiveIdRef.current !== activeIdToSave;
      if (dirty.length === 0 && !activeIdChanged) return;

      setIsSaving(true);
      setSaveError(null);
      try {
        // Externalize inline data: images into the content-addressed blob
        // store, so persisted project JSON holds short pblob: refs (not MB of
        // base64). Identical images dedupe to one blob.
        const externalized = await Promise.all(dirty.map(externalizeProject));
        await saveEditorState(externalized, activeIdToSave);
        // Mark everything currently in memory as clean (by reference).
        const nextMap = new Map<string, Project>();
        for (const p of projectsToSave) nextMap.set(p.id, p);
        lastSavedRef.current = nextMap;
        lastSavedActiveIdRef.current = activeIdToSave;
        setLastSaved(Date.now());
      } catch (err) {
        console.error("Failed to save editor state:", err);
        setSaveError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSaving(false);
      }
    });
    saveChainRef.current = next;
    return next;
  }, []);

  // --- Debounced auto-save --------------------------------------------------
  useEffect(() => {
    if (!enabled) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(doSave, AUTO_SAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [projects, activeProjectId, enabled, doSave]);

  // --- beforeunload flush ---------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Fire-and-forget; IndexedDB will queue the write even as the page unloads.
      void doSave();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled, doSave]);

  const flush = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await doSave();
  }, [doSave]);

  const cancelPending = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  return {
    isHydrating,
    hydrated,
    isSaving,
    lastSaved,
    saveError,
    flush,
    cancelPending,
  };
};
