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
  migrateFromLocalStorage,
  saveEditorState,
} from "./storage/db";

const AUTO_SAVE_DELAY_MS = 800;

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
        setHydrated({
          projects: projectList,
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
      setIsSaving(true);
      setSaveError(null);
      try {
        await saveEditorState(projectsToSave, activeIdToSave);
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
