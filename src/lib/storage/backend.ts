/**
 * Storage backend abstraction.
 *
 * Prestige persists projects + snapshots through one of two implementations:
 *
 *   - IndexedDBBackend (web build)   — uses idb
 *   - FilesystemBackend (Tauri build) — writes JSON files under $APPDATA
 *
 * Both implementations live behind this interface so the rest of the app
 * stays storage-agnostic. The chosen backend is selected once at module load
 * by `db.ts` based on `isTauri()`.
 */

import type { Project } from "../../types";

export interface Snapshot {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  project: Project;
}

export interface StorageBackend {
  // Projects
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  putProjects(projects: Project[]): Promise<void>;
  putProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  replaceAllProjects(projects: Project[]): Promise<void>;

  // Atomic save (projects + activeProjectId in a single transaction where
  // the underlying store supports it).
  saveEditorState(projects: Project[], activeProjectId: string): Promise<void>;

  // Snapshots
  listSnapshots(projectId: string): Promise<Snapshot[]>;
  putSnapshot(snapshot: Snapshot): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  getSnapshot(id: string): Promise<Snapshot | undefined>;

  // Meta (singleton key/value rows)
  getMeta<T = unknown>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;

  // One-time migration from previous storage shapes. Returns the data that
  // was imported, or null if there was nothing to migrate.
  migrate(): Promise<{ projects: Project[]; activeProjectId?: string } | null>;

  // Wipes all projects, snapshots, and meta. Used by resetEditor.
  clearAll(): Promise<void>;
}
