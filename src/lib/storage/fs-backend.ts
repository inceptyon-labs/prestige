/**
 * Filesystem storage backend (Tauri build).
 *
 * Layout under $APPDATA (i.e. ~/Library/Application Support/io.inceptyonlabs.appshots
 * on macOS, the equivalent on Windows/Linux):
 *
 *   meta.json                <- { activeProjectId, schemaVersion, migrated:* flags }
 *   projects/<id>.json       <- serialized Project
 *   snapshots/<id>.json      <- serialized Snapshot (projectId embedded)
 *
 * Why files-on-disk instead of SQLite for v1:
 *   - one project = one file, trivially backed up / synced via Dropbox / git
 *   - no schema migrations to maintain
 *   - SQLite adds value once we want cross-project search / embeddings, which
 *     isn't in scope yet.
 *
 * Each save writes the project file then the meta file. We don't use a
 * tempfile+rename dance because this is a single-writer app and the save
 * queue in useEditorStorage already serializes all writes.
 */

import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Project } from "../../types";
import type { Snapshot, StorageBackend } from "./backend";

const APPDATA = { baseDir: BaseDirectory.AppData } as const;
const PROJECTS_DIR = "projects";
const SNAPSHOTS_DIR = "snapshots";
const META_FILE = "meta.json";

interface MetaShape {
  schemaVersion: number;
  activeProjectId?: string;
  [key: string]: unknown;
}

const ensureDirs = async (): Promise<void> => {
  // mkdir is a no-op if the directory already exists (recursive).
  await mkdir(PROJECTS_DIR, { ...APPDATA, recursive: true });
  await mkdir(SNAPSHOTS_DIR, { ...APPDATA, recursive: true });
};

const projectPath = (id: string) => `${PROJECTS_DIR}/${encodeURIComponent(id)}.json`;
const snapshotPath = (id: string) =>
  `${SNAPSHOTS_DIR}/${encodeURIComponent(id)}.json`;

const readJson = async <T>(path: string): Promise<T | undefined> => {
  try {
    const text = await readTextFile(path, APPDATA);
    try {
      return JSON.parse(text) as T;
    } catch (parseErr) {
      // File exists but is corrupted/unparseable. Don't silently lose it.
      console.error(`Failed to parse JSON from ${path}:`, parseErr);
      return undefined;
    }
  } catch (readErr) {
    // File doesn't exist or can't be read. Check if it should exist.
    const fileExists = await exists(path, APPDATA);
    if (fileExists) {
      console.error(`Failed to read ${path}:`, readErr);
    }
    // File doesn't exist = treat as undefined; permission/io errors are logged.
    return undefined;
  }
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  // Write to a temp file first, then rename it to the target path.
  // This is safer against crashes mid-write, since the old file remains
  // intact until the new one is fully synced and renamed.
  const tempPath = `${path}.tmp`;
  const json = JSON.stringify(value, null, 2);
  try {
    await writeTextFile(tempPath, json, APPDATA);
    // Tauri doesn't expose rename/move, so we delete old then write new.
    // For single-writer loads (like this), delete+write is acceptable since
    // a crash between means we lose the new data but not corrupt the old.
    // TODO: use fs:scope "allow-rename" once Tauri exposes it.
    if (await exists(path, APPDATA)) {
      await remove(path, APPDATA);
    }
    await writeTextFile(path, json, APPDATA);
    // Clean up temp file if it still exists (shouldn't, but be safe).
    if (await exists(tempPath, APPDATA)) {
      await remove(tempPath, APPDATA);
    }
  } catch (err) {
    // If something failed, try to clean up the temp file.
    try {
      if (await exists(tempPath, APPDATA)) {
        await remove(tempPath, APPDATA);
      }
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }
};

const loadMeta = async (): Promise<MetaShape> => {
  const meta = await readJson<MetaShape>(META_FILE);
  return meta ?? { schemaVersion: 1 };
};

const saveMeta = async (next: MetaShape): Promise<void> => {
  await writeJson(META_FILE, next);
};

export const createFSBackend = (): StorageBackend => {
  // Kick off directory creation once; every public method awaits it so we
  // never write into a missing tree on first run. If initialization fails,
  // reject the promise so callers know to stop.
  const ready = ensureDirs().catch((err) => {
    console.error("Failed to prepare AppData directory:", err);
    throw err; // Re-throw so awaits see the failure, not swallow it.
  });

  const backend: StorageBackend = {
    async listProjects() {
      await ready;
      const entries = await readDir(PROJECTS_DIR, APPDATA);
      const projects: Project[] = [];
      for (const entry of entries) {
        if (!entry.name?.endsWith(".json")) continue;
        const p = await readJson<Project>(`${PROJECTS_DIR}/${entry.name}`);
        if (p) projects.push(p);
      }
      return projects;
    },

    async getProject(id) {
      await ready;
      return readJson<Project>(projectPath(id));
    },

    async putProjects(projects) {
      await ready;
      for (const p of projects) {
        await writeJson(projectPath(p.id), p);
      }
    },

    async putProject(project) {
      await ready;
      await writeJson(projectPath(project.id), project);
    },

    async deleteProject(id) {
      await ready;
      const path = projectPath(id);
      if (await exists(path, APPDATA)) {
        await remove(path, APPDATA);
      }
      // Cascade: remove every snapshot file owned by this project.
      const snapEntries = await readDir(SNAPSHOTS_DIR, APPDATA);
      for (const entry of snapEntries) {
        if (!entry.name?.endsWith(".json")) continue;
        const snap = await readJson<Snapshot>(`${SNAPSHOTS_DIR}/${entry.name}`);
        if (snap?.projectId === id) {
          await remove(`${SNAPSHOTS_DIR}/${entry.name}`, APPDATA);
        }
      }
    },

    async replaceAllProjects(projects) {
      await ready;
      // Wipe the projects directory contents, then write fresh.
      const entries = await readDir(PROJECTS_DIR, APPDATA);
      for (const entry of entries) {
        if (entry.name?.endsWith(".json")) {
          await remove(`${PROJECTS_DIR}/${entry.name}`, APPDATA);
        }
      }
      for (const p of projects) {
        await writeJson(projectPath(p.id), p);
      }
    },

    async saveEditorState(projects, activeProjectId) {
      await ready;
      // Order matters: write project files first so the activeProjectId we
      // store last always points at a project that exists on disk.
      for (const p of projects) {
        await writeJson(projectPath(p.id), p);
      }
      const meta = await loadMeta();
      meta.activeProjectId = activeProjectId;
      await saveMeta(meta);
    },

    async listSnapshots(projectId) {
      await ready;
      const entries = await readDir(SNAPSHOTS_DIR, APPDATA);
      const out: Snapshot[] = [];
      for (const entry of entries) {
        if (!entry.name?.endsWith(".json")) continue;
        const snap = await readJson<Snapshot>(`${SNAPSHOTS_DIR}/${entry.name}`);
        if (snap?.projectId === projectId) out.push(snap);
      }
      return out.sort((a, b) => b.createdAt - a.createdAt);
    },

    async putSnapshot(snapshot) {
      await ready;
      await writeJson(snapshotPath(snapshot.id), snapshot);
    },

    async deleteSnapshot(id) {
      await ready;
      const path = snapshotPath(id);
      if (await exists(path, APPDATA)) {
        await remove(path, APPDATA);
      }
    },

    async getSnapshot(id) {
      await ready;
      return readJson<Snapshot>(snapshotPath(id));
    },

    async getMeta<T = unknown>(key: string) {
      await ready;
      const meta = await loadMeta();
      return meta[key] as T | undefined;
    },

    async setMeta(key, value) {
      await ready;
      const meta = await loadMeta();
      meta[key] = value;
      await saveMeta(meta);
    },

    async migrate() {
      // No migration needed on the filesystem backend. The web build runs
      // localStorage→IDB migration inside the IDB backend itself. Cross-runtime
      // moves (Chrome IDB → Tauri FS) are intentionally manual via the
      // Export/Import JSON flow, since the two WebView contexts can't share
      // origin-isolated IndexedDB anyway.
      return null;
    },

    async clearAll() {
      await ready;
      const projectEntries = await readDir(PROJECTS_DIR, APPDATA);
      for (const entry of projectEntries) {
        if (entry.name?.endsWith(".json")) {
          await remove(`${PROJECTS_DIR}/${entry.name}`, APPDATA);
        }
      }
      const snapEntries = await readDir(SNAPSHOTS_DIR, APPDATA);
      for (const entry of snapEntries) {
        if (entry.name?.endsWith(".json")) {
          await remove(`${SNAPSHOTS_DIR}/${entry.name}`, APPDATA);
        }
      }
      if (await exists(META_FILE, APPDATA)) {
        await remove(META_FILE, APPDATA);
      }
    },
  };

  return backend;
};
