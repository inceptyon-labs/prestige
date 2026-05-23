/**
 * Storage façade.
 *
 * Picks the right backend (IndexedDB on web, filesystem under $APPDATA on
 * Tauri) once at module load and re-exports a flat function API so the rest
 * of the app doesn't have to know which one is active.
 *
 * To switch backends, only this file and the runtime detection in
 * ../runtime.ts need to change.
 */

import { isTauri } from "../runtime";
import type { Project } from "../../types";
import type { Snapshot, StorageBackend } from "./backend";
import { createIDBBackend } from "./idb-backend";
import { createFSBackend } from "./fs-backend";

export type { Snapshot } from "./backend";

const backend: StorageBackend = isTauri()
  ? createFSBackend()
  : createIDBBackend();

// --- Projects ---------------------------------------------------------------
export const listProjects = (): Promise<Project[]> => backend.listProjects();
export const getProject = (id: string): Promise<Project | undefined> =>
  backend.getProject(id);
export const putProjects = (projects: Project[]): Promise<void> =>
  backend.putProjects(projects);
export const putProject = (project: Project): Promise<void> =>
  backend.putProject(project);
export const deleteProject = (id: string): Promise<void> =>
  backend.deleteProject(id);
export const replaceAllProjects = (projects: Project[]): Promise<void> =>
  backend.replaceAllProjects(projects);
export const saveEditorState = (
  projects: Project[],
  activeProjectId: string,
): Promise<void> => backend.saveEditorState(projects, activeProjectId);

// --- Snapshots --------------------------------------------------------------
export const listSnapshots = (projectId: string): Promise<Snapshot[]> =>
  backend.listSnapshots(projectId);
export const putSnapshot = (snapshot: Snapshot): Promise<void> =>
  backend.putSnapshot(snapshot);
export const deleteSnapshot = (id: string): Promise<void> =>
  backend.deleteSnapshot(id);
export const getSnapshot = (id: string): Promise<Snapshot | undefined> =>
  backend.getSnapshot(id);

// --- Meta -------------------------------------------------------------------
export const getMeta = <T = unknown>(key: string): Promise<T | undefined> =>
  backend.getMeta<T>(key);
export const setMeta = (key: string, value: unknown): Promise<void> =>
  backend.setMeta(key, value);

// --- One-time migration -----------------------------------------------------
/**
 * Run on hydration so we pull in data left over from a previous storage
 * shape (e.g. localStorage on the web, or IDB on early Tauri builds).
 */
export const migrateFromLocalStorage = (): Promise<{
  projects: Project[];
  activeProjectId?: string;
} | null> => backend.migrate();

// --- Clear everything (for resetEditor) ------------------------------------
export const clearAll = (): Promise<void> => backend.clearAll();
