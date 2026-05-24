/**
 * IndexedDB storage backend (web build).
 *
 * Wraps the `idb` library and adapts it to the StorageBackend interface.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Project } from "../../types";
import type { Snapshot, StorageBackend } from "./backend";

const DB_NAME = "prestige";
const DB_VERSION = 1;
const LEGACY_LOCALSTORAGE_KEY = "app-screenshot-editor-state";
const MIGRATION_FLAG = "migrated:localstorage-v1";

interface PrestigeSchema extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  snapshots: {
    key: string;
    value: Snapshot;
    indexes: { "by-project": string };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<PrestigeSchema>> | null = null;

const getDB = (): Promise<IDBPDatabase<PrestigeSchema>> => {
  if (!dbPromise) {
    dbPromise = openDB<PrestigeSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("snapshots")) {
          const snaps = db.createObjectStore("snapshots", { keyPath: "id" });
          snaps.createIndex("by-project", "projectId");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
};

interface LegacyPersistedState {
  version?: number;
  projects?: Project[];
  activeProjectId?: string;
}

export const createIDBBackend = (): StorageBackend => ({
  async listProjects() {
    const db = await getDB();
    return db.getAll("projects");
  },

  async getProject(id) {
    const db = await getDB();
    return db.get("projects", id);
  },

  async putProjects(projects) {
    const db = await getDB();
    const tx = db.transaction("projects", "readwrite");
    await Promise.all(projects.map((p) => tx.store.put(p)));
    await tx.done;
  },

  async putProject(project) {
    const db = await getDB();
    await db.put("projects", project);
  },

  async deleteProject(id) {
    const db = await getDB();
    const tx = db.transaction(["projects", "snapshots"], "readwrite");
    await tx.objectStore("projects").delete(id);
    const snapIndex = tx.objectStore("snapshots").index("by-project");
    for await (const cursor of snapIndex.iterate(id)) {
      await cursor.delete();
    }
    await tx.done;
  },

  async replaceAllProjects(projects) {
    const db = await getDB();
    const tx = db.transaction("projects", "readwrite");
    await tx.store.clear();
    await Promise.all(projects.map((p) => tx.store.put(p)));
    await tx.done;
  },

  async saveEditorState(projects, activeProjectId) {
    const db = await getDB();
    const tx = db.transaction(["projects", "meta"], "readwrite");
    const projectsStore = tx.objectStore("projects");
    const metaStore = tx.objectStore("meta");
    await Promise.all(projects.map((p) => projectsStore.put(p)));
    await metaStore.put({ key: "activeProjectId", value: activeProjectId });
    await tx.done;
  },

  async listSnapshots(projectId) {
    const db = await getDB();
    const all = await db.getAllFromIndex(
      "snapshots",
      "by-project",
      projectId,
    );
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },

  async putSnapshot(snapshot) {
    const db = await getDB();
    await db.put("snapshots", snapshot);
  },

  async deleteSnapshot(id) {
    const db = await getDB();
    await db.delete("snapshots", id);
  },

  async getSnapshot(id) {
    const db = await getDB();
    return db.get("snapshots", id);
  },

  async getMeta<T = unknown>(key: string) {
    const db = await getDB();
    const row = await db.get("meta", key);
    return row?.value as T | undefined;
  },

  async setMeta(key, value) {
    const db = await getDB();
    await db.put("meta", { key, value });
  },

  async migrate() {
    if (typeof window === "undefined") return null;

    const already = await this.getMeta<boolean>(MIGRATION_FLAG);
    if (already) return null;

    let parsed: LegacyPersistedState | null = null;
    try {
      const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
      if (raw) parsed = JSON.parse(raw) as LegacyPersistedState;
    } catch {
      parsed = null;
    }

    if (!parsed?.projects || parsed.projects.length === 0) {
      await this.setMeta(MIGRATION_FLAG, true);
      return null;
    }

    // Write data + flag atomically.
    const db = await getDB();
    const tx = db.transaction(["projects", "meta"], "readwrite");
    const projectsStore = tx.objectStore("projects");
    const metaStore = tx.objectStore("meta");
    await Promise.all(parsed.projects.map((p) => projectsStore.put(p)));
    if (parsed.activeProjectId) {
      await metaStore.put({
        key: "activeProjectId",
        value: parsed.activeProjectId,
      });
    }
    await metaStore.put({ key: MIGRATION_FLAG, value: true });
    await tx.done;

    return {
      projects: parsed.projects,
      activeProjectId: parsed.activeProjectId,
    };
  },

  async clearAll() {
    const db = await getDB();
    const tx = db.transaction(
      ["projects", "snapshots", "meta"],
      "readwrite",
    );
    await tx.objectStore("projects").clear();
    await tx.objectStore("snapshots").clear();
    await tx.objectStore("meta").clear();
    await tx.done;
    try {
      localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    } catch {
      // ignore
    }
  },
});
