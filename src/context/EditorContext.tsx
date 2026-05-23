import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  DeviceSpec,
  DeviceColor,
  DeviceInstance,
  ExportSize,
  Screenshot,
  ImageOverlay,
  ShadowConfig,
  Project,
  SelectedElement,
} from "../types";
import { devices, exportSizes, gradientPresets } from "../constants";
import { exportScreenshots } from "../lib/export-utils";
import {
  cloneDeviceInstance,
  createDeviceInstance,
  ensureDeviceInstances,
  getDeviceColorById,
  getDeviceSpecById,
} from "../lib/device-instances";
import { useEditorStorage } from "../lib/useEditorStorage";
import {
  clearAll as clearAllStorage,
  deleteProject as deleteProjectDb,
  deleteSnapshot as deleteSnapshotDb,
  listSnapshots as listSnapshotsDb,
  putSnapshot,
  type Snapshot,
} from "../lib/storage/db";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

interface EditorContextType {
  // Project state
  projects: Project[];
  activeProjectId: string;
  activeProject: Project;
  createProject: (name: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => Promise<void>;
  switchProject: (id: string) => void;

  // State
  isFontPickerOpen: boolean;
  setIsFontPickerOpen: (open: boolean) => void;
  isStarModalOpen: boolean;
  setIsStarModalOpen: (open: boolean) => void;
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  selectedColorId: string;
  setSelectedColorId: (id: string) => void;
  exportSizeId: string;
  setExportSizeId: (id: string) => void;
  screenshots: Screenshot[];
  setScreenshots: (screenshots: Screenshot[]) => void;
  activeScreenshotId: string;
  setActiveScreenshotId: (id: string) => void;
  selectedElement: SelectedElement | null;
  setSelectedElement: (element: SelectedElement | null) => void;
  isDragging: boolean;
  headlineFontSize: number;
  setHeadlineFontSize: (size: number) => void;
  subheadlineFontSize: number;
  setSubheadlineFontSize: (size: number) => void;
  previewDimensions: { width: number; height: number };
  setPreviewDimensions: (dim: { width: number; height: number }) => void;

  // Refs
  previewRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  overlayImageInputRef: React.RefObject<HTMLInputElement | null>;

  // Derived
  selectedDevice: DeviceSpec;
  selectedColor: DeviceColor;
  activeScreenshot: Screenshot;
  activeDevice: DeviceInstance;
  exportSize: ExportSize;

  // Actions
  updateActiveScreenshot: (updates: Partial<Screenshot>) => void;
  addScreenshot: () => void;
  removeScreenshot: (id: string) => void;
  handleElementMouseDown: (
    e: React.MouseEvent,
    type: "headline" | "subheadline" | "image" | "device",
    screenshotId: string,
    id?: string,
  ) => void;
  handleElementMouseMove: (e: MouseEvent) => void;
  handleElementMouseUp: () => void;
  addOverlayImage: (file: File) => void;
  removeOverlayImage: (imageId: string) => void;
  updateOverlayImageSize: (imageId: string, widthPercent: number) => void;
  updateOverlayImageLayer: (imageId: string, layer: "behind" | "front") => void;
  updateOverlayImageRotation: (imageId: string, rotation: number) => void;
  updateOverlayImageShadow: (
    imageId: string,
    shadow: Partial<ShadowConfig>,
  ) => void;
  addDevice: () => void;
  selectDevice: (deviceId: string) => void;
  removeDevice: (deviceId: string) => void;
  bringDeviceForward: (deviceId: string) => void;
  sendDeviceBackward: (deviceId: string) => void;
  bringImageForward: (imageId: string) => void;
  sendImageBackward: (imageId: string) => void;
  bringImageToFront: (imageId: string) => void;
  sendImageToBack: (imageId: string) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleExport: () => void;
  getBackgroundStyle: (screenshot: Screenshot) => string;
  resetEditor: () => Promise<void>;

  // Persistence status
  isSaving: boolean;
  lastSaved: number;
  saveError: string | null;
  saveNow: () => Promise<void>;

  // Snapshots
  snapshots: Snapshot[];
  refreshSnapshots: () => Promise<void>;
  createSnapshot: (name: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  deleteSnapshot: (snapshotId: string) => Promise<void>;

  // Export / Import
  exportProjectToFile: (projectId?: string) => void;
  importProjectFromFile: (file: File) => Promise<void>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

type LegacyScreenshotFields = {
  screenshotSrc?: string | null;
  deviceScale?: number;
  deviceOffsetY?: number;
  deviceRotation?: number;
  deviceShadow?: ShadowConfig;
  deviceStyle?: "flat" | "3d";
  device3dRotateY?: number;
  device3dRotateX?: number;
};

// Default screenshot for new editors
const createDefaultScreenshot = (
  defaultDeviceId: string = devices[0].id,
  defaultColorId: string = devices[0].colors[0].id,
): Screenshot => {
  const defaultDevice = createDeviceInstance({
    deviceId: defaultDeviceId,
    colorId: defaultColorId,
  });

  return {
    id: generateId(),
    headline: "Showcase Your App",
    subheadline:
      "Create stunning App Store screenshots in minutes. Customizable templates, devices, and backgrounds.",
    backgroundColor: "#8b5cf6",
    backgroundMode: "solid",
    gradientPresetId: null,
    textColor: "#ffffff",
    headlineX: 50,
    headlineY: 10,
    headlineWidth: 80,
    subheadlineX: 50,
    subheadlineY: 18,
    subheadlineWidth: 80,
    fontFamily: "Inter",
    overlayImages: [],
    devices: [defaultDevice],
    activeDeviceId: defaultDevice.id,
  };
};

const normalizeScreenshot = (
  screenshot: Partial<Screenshot> & LegacyScreenshotFields,
  fallbackDeviceId: string,
  fallbackColorId: string,
): Screenshot => {
  const {
    screenshotSrc: _legacyScreenshotSrc,
    deviceScale: _legacyDeviceScale,
    deviceOffsetY: _legacyDeviceOffsetY,
    deviceRotation: _legacyDeviceRotation,
    deviceShadow: _legacyDeviceShadow,
    deviceStyle: _legacyDeviceStyle,
    device3dRotateY: _legacyDevice3dRotateY,
    device3dRotateX: _legacyDevice3dRotateX,
    ...rest
  } = screenshot;
  const baseScreenshot = createDefaultScreenshot(fallbackDeviceId, fallbackColorId);
  const { devices: deviceInstances, activeDeviceId } = ensureDeviceInstances(
    screenshot,
    fallbackDeviceId,
    fallbackColorId,
  );

  return {
    ...baseScreenshot,
    ...rest,
    overlayImages: screenshot.overlayImages ?? [],
    devices: deviceInstances,
    activeDeviceId,
  };
};

const normalizeProject = (project: Project): Project => {
  const fallbackDeviceId = project.selectedDeviceId ?? devices[0].id;
  const fallbackColorId =
    project.selectedColorId ?? getDeviceSpecById(fallbackDeviceId).colors[0].id;
  const normalizedScreenshots = project.screenshots.map((screenshot) =>
    normalizeScreenshot(screenshot, fallbackDeviceId, fallbackColorId),
  );

  return {
    ...project,
    selectedDeviceId: fallbackDeviceId,
    selectedColorId: fallbackColorId,
    screenshots: normalizedScreenshots,
    activeScreenshotId:
      normalizedScreenshots.find((s) => s.id === project.activeScreenshotId)?.id ??
      normalizedScreenshots[0].id,
  };
};

// Create a default project
const createDefaultProject = (name: string = "My Project"): Project => {
  const defaultDeviceId = devices[0].id;
  const defaultColorId = devices[0].colors[0].id;
  const defaultScreenshot = createDefaultScreenshot(defaultDeviceId, defaultColorId);
  return {
    id: generateId(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    screenshots: [defaultScreenshot],
    selectedDeviceId: defaultDeviceId,
    selectedColorId: defaultColorId,
    exportSizeId: exportSizes[0].id,
    activeScreenshotId: defaultScreenshot.id,
    headlineFontSize: 72,
    subheadlineFontSize: 42,
  };
};

export const EditorProvider = ({ children }: { children: ReactNode }) => {
  // Start with a default project; replace once IndexedDB hydration finishes.
  const [projects, setProjects] = useState<Project[]>(() => [createDefaultProject()]);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    () => projects[0].id,
  );
  const [isHydrated, setIsHydrated] = useState(false);

  // Get active project
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  // Initialize state from persisted values or defaults
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const [isStarModalOpen, setIsStarModalOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState(
    activeProject.selectedDeviceId,
  );
  const [selectedColorId, setSelectedColorIdState] = useState(
    activeProject.selectedColorId,
  );
  const [exportSizeId, setExportSizeIdState] = useState(
    activeProject.exportSizeId,
  );
  const [screenshots, setScreenshotsState] = useState<Screenshot[]>(
    activeProject.screenshots,
  );
  const [activeScreenshotId, setActiveScreenshotIdState] = useState(
    activeProject.activeScreenshotId,
  );
  const [headlineFontSize, setHeadlineFontSizeState] = useState(
    activeProject.headlineFontSize,
  );
  const [subheadlineFontSize, setSubheadlineFontSizeState] = useState(
    activeProject.subheadlineFontSize,
  );

  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(
    null,
  );

  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartElementPos = useRef({ x: 0, y: 0 });
  const dragContainerSize = useRef({ width: 0, height: 0 });
  const rafId = useRef<number | null>(null);
  const pendingUpdate = useRef<{ x: number; y: number } | null>(null);

  const overlayImageInputRef = useRef<HTMLInputElement>(null);

  const [previewDimensions, setPreviewDimensions] = useState({
    width: 0,
    height: 0,
  });

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Sync project state when local state changes
  const updateProjectState = useCallback(() => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? {
              ...p,
              screenshots,
              selectedDeviceId,
              selectedColorId,
              exportSizeId,
              activeScreenshotId,
              headlineFontSize,
              subheadlineFontSize,
              updatedAt: Date.now(),
            }
          : p,
      ),
    );
  }, [
    activeProjectId,
    screenshots,
    selectedDeviceId,
    selectedColorId,
    exportSizeId,
    activeScreenshotId,
    headlineFontSize,
    subheadlineFontSize,
  ]);

  // Update project whenever state changes
  useEffect(() => {
    updateProjectState();
  }, [updateProjectState]);

  // Auto-save projects to IndexedDB (enabled only after hydration so we don't
  // race-overwrite stored data with the bootstrap default project).
  const {
    isHydrating,
    hydrated,
    isSaving,
    lastSaved,
    saveError,
    flush: saveNow,
    cancelPending: cancelPendingSave,
  } = useEditorStorage(projects, activeProjectId, isHydrated);

  // Apply hydrated state once it arrives from IndexedDB.
  useEffect(() => {
    if (isHydrating || isHydrated) return;
    if (hydrated && hydrated.projects.length > 0) {
      const normalized = hydrated.projects.map(normalizeProject);
      const activeId =
        normalized.find((p) => p.id === hydrated.activeProjectId)?.id ??
        normalized[0].id;
      const active = normalized.find((p) => p.id === activeId) ?? normalized[0];
      setProjects(normalized);
      setActiveProjectId(activeId);
      setSelectedDeviceIdState(active.selectedDeviceId);
      setSelectedColorIdState(active.selectedColorId);
      setExportSizeIdState(active.exportSizeId);
      setScreenshotsState(active.screenshots);
      setActiveScreenshotIdState(active.activeScreenshotId);
      setHeadlineFontSizeState(active.headlineFontSize);
      setSubheadlineFontSizeState(active.subheadlineFontSize);
    }
    setIsHydrated(true);
  }, [isHydrating, hydrated, isHydrated]);

  // Snapshots list for the currently active project. A request counter
  // discards results from older active-project ids so a slow IDB read against
  // the previous project can't overwrite the current project's list.
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const snapshotRequestIdRef = useRef(0);
  const snapshotProjectIdRef = useRef(activeProjectId);

  const refreshSnapshots = useCallback(async () => {
    if (!activeProjectId) return;
    const reqId = ++snapshotRequestIdRef.current;
    const projectIdAtRequest = activeProjectId;
    try {
      const list = await listSnapshotsDb(projectIdAtRequest);
      if (
        reqId === snapshotRequestIdRef.current &&
        snapshotProjectIdRef.current === projectIdAtRequest
      ) {
        setSnapshots(list);
      }
    } catch (err) {
      console.error("Failed to load snapshots:", err);
    }
  }, [activeProjectId]);

  // Clear stale snapshots immediately on project change so the UI never shows
  // another project's versions, even before refreshSnapshots resolves.
  useEffect(() => {
    snapshotProjectIdRef.current = activeProjectId;
    setSnapshots([]);
    if (isHydrated) void refreshSnapshots();
  }, [isHydrated, activeProjectId, refreshSnapshots]);

  const createSnapshot = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      // Make sure the latest in-memory state is persisted first.
      await saveNow();
      const project = projects.find((p) => p.id === activeProjectId);
      if (!project) return;
      const snapshot: Snapshot = {
        id: generateId(),
        projectId: activeProjectId,
        name: trimmed,
        createdAt: Date.now(),
        project: { ...project, updatedAt: Date.now() },
      };
      await putSnapshot(snapshot);
      await refreshSnapshots();
    },
    [activeProjectId, projects, refreshSnapshots, saveNow],
  );

  const restoreSnapshot = useCallback(
    async (snapshotId: string) => {
      const snap = snapshots.find((s) => s.id === snapshotId);
      if (!snap) return;
      // Guard against stale list entries that belong to a different project.
      if (snap.projectId !== activeProjectId) {
        console.warn(
          `Refusing to restore snapshot ${snap.id} from project ${snap.projectId} into active project ${activeProjectId}`,
        );
        return;
      }
      const normalized = normalizeProject({
        ...snap.project,
        id: activeProjectId,
        updatedAt: Date.now(),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? normalized : p)),
      );
      setSelectedDeviceIdState(normalized.selectedDeviceId);
      setSelectedColorIdState(normalized.selectedColorId);
      setExportSizeIdState(normalized.exportSizeId);
      setScreenshotsState(normalized.screenshots);
      setActiveScreenshotIdState(normalized.activeScreenshotId);
      setHeadlineFontSizeState(normalized.headlineFontSize);
      setSubheadlineFontSizeState(normalized.subheadlineFontSize);
      setSelectedElement(null);
    },
    [snapshots, activeProjectId],
  );

  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      await deleteSnapshotDb(snapshotId);
      await refreshSnapshots();
    },
    [refreshSnapshots],
  );

  const exportProjectToFile = useCallback(
    (projectId?: string) => {
      const target = projects.find((p) => p.id === (projectId ?? activeProjectId));
      if (!target) return;
      const payload = {
        format: "appshots-project",
        version: 1,
        exportedAt: new Date().toISOString(),
        project: target,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const safeName = target.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName || "project"}.appshots.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [projects, activeProjectId],
  );

  const importProjectFromFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Selected file is not valid JSON.");
      }
      const raw = parsed as { format?: string; project?: Project };
      if (raw?.format !== "appshots-project" || !raw.project) {
        throw new Error("Selected file is not an AppShots project export.");
      }
      const imported = normalizeProject({
        ...raw.project,
        id: generateId(),
        name: `${raw.project.name} (imported)`,
        updatedAt: Date.now(),
        createdAt: Date.now(),
      });
      setProjects((prev) => [...prev, imported]);
      setActiveProjectId(imported.id);
      setSelectedDeviceIdState(imported.selectedDeviceId);
      setSelectedColorIdState(imported.selectedColorId);
      setExportSizeIdState(imported.exportSizeId);
      setScreenshotsState(imported.screenshots);
      setActiveScreenshotIdState(imported.activeScreenshotId);
      setHeadlineFontSizeState(imported.headlineFontSize);
      setSubheadlineFontSizeState(imported.subheadlineFontSize);
      setSelectedElement(null);
    },
    [],
  );

  // Wrapper functions that update both local state and project
  const setSelectedDeviceId = (id: string) => {
    setSelectedDeviceIdState(id);
    const nextColorId = getDeviceColorById(id, selectedColorId).id;
    setSelectedColorIdState(nextColorId);
    setScreenshotsState((prev) =>
      prev.map((screenshot) =>
        screenshot.id === activeScreenshotId
          ? {
              ...screenshot,
              devices: screenshot.devices.map((device) =>
                device.id === screenshot.activeDeviceId
                  ? { ...device, deviceId: id, colorId: nextColorId }
                  : device,
              ),
            }
          : screenshot,
      ),
    );
  };
  const setSelectedColorId = (id: string) => {
    setSelectedColorIdState(id);
    setScreenshotsState((prev) =>
      prev.map((screenshot) =>
        screenshot.id === activeScreenshotId
          ? {
              ...screenshot,
              devices: screenshot.devices.map((device) =>
                device.id === screenshot.activeDeviceId
                  ? { ...device, colorId: id }
                  : device,
              ),
            }
          : screenshot,
      ),
    );
  };
  const setExportSizeId = (id: string) => {
    setExportSizeIdState(id);
  };
  const setScreenshots = (newScreenshots: Screenshot[]) => {
    setScreenshotsState(newScreenshots);
  };
  const setActiveScreenshotId = (id: string) => {
    setActiveScreenshotIdState(id);
  };
  const setHeadlineFontSize = (size: number) => {
    setHeadlineFontSizeState(size);
  };
  const setSubheadlineFontSize = (size: number) => {
    setSubheadlineFontSizeState(size);
  };

  // Apply a project's per-field state to the editor without relying on the
  // (possibly stale) `projects` array. Used by createProject, switchProject,
  // deleteProject, restoreSnapshot, importProject and resetEditor.
  const applyProjectToState = useCallback((project: Project) => {
    setActiveProjectId(project.id);
    setSelectedDeviceIdState(project.selectedDeviceId);
    setSelectedColorIdState(project.selectedColorId);
    setExportSizeIdState(project.exportSizeId);
    setScreenshotsState(project.screenshots);
    setActiveScreenshotIdState(project.activeScreenshotId);
    setHeadlineFontSizeState(project.headlineFontSize);
    setSubheadlineFontSizeState(project.subheadlineFontSize);
    setSelectedElement(null);
  }, []);

  // Project management functions
  const createProject = (name: string) => {
    const newProject = createDefaultProject(name);
    setProjects((prev) => [...prev, newProject]);
    // Don't go through switchProject — its lookup against `projects` won't
    // see the new project until React commits the setProjects above.
    applyProjectToState(newProject);
  };

  const renameProject = (id: string, name: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
      ),
    );
  };

  const deleteProject = async (id: string) => {
    // Don't delete the last project
    if (projects.length <= 1) return;

    // CRITICAL: Cancel any pending auto-save before deleting, so a queued
    // `saveEditorState` doesn't resurrect the deleted project. Then await the
    // DB deletion to complete before allowing the next auto-save.
    cancelPendingSave();
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);

    // If deleting active project, switch state to a remaining one directly so
    // we don't depend on the not-yet-committed `projects` value.
    if (id === activeProjectId && remaining.length > 0) {
      applyProjectToState(remaining[0]);
    }

    // Drop the project (and its snapshots, via the cascading delete in db.ts)
    // from IndexedDB. Without this, auto-save's upsert-only behaviour leaves
    // the deleted record in storage and it reappears on the next reload.
    try {
      await deleteProjectDb(id);
    } catch (err) {
      console.error(`Failed to delete project ${id}:`, err);
    }
  };

  const switchProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    applyProjectToState(project);
  };

  const selectedDevice =
    getDeviceSpecById(selectedDeviceId);
  const selectedColor =
    getDeviceColorById(selectedDevice.id, selectedColorId);
  const activeScreenshot =
    screenshots.find((s) => s.id === activeScreenshotId) || screenshots[0];
  const activeDevice =
    activeScreenshot.devices.find(
      (device) => device.id === activeScreenshot.activeDeviceId,
    ) || activeScreenshot.devices[0];
  const exportSize =
    exportSizes.find((s) => s.id === exportSizeId) || exportSizes[0];

  const updateScreenshotById = useCallback(
    (screenshotId: string, updates: Partial<Screenshot>) => {
      setScreenshotsState((prev) =>
        prev.map((s) => (s.id === screenshotId ? { ...s, ...updates } : s)),
      );
    },
    [],
  );

  const updateActiveScreenshot = useCallback(
    (updates: Partial<Screenshot>) => {
      updateScreenshotById(activeScreenshotId, updates);
    },
    [activeScreenshotId, updateScreenshotById],
  );

  useEffect(() => {
    if (!activeDevice) return;
    if (selectedDeviceId !== activeDevice.deviceId) {
      setSelectedDeviceIdState(activeDevice.deviceId);
    }
    if (selectedColorId !== activeDevice.colorId) {
      setSelectedColorIdState(activeDevice.colorId);
    }
    if (activeScreenshot.activeDeviceId !== activeDevice.id) {
      updateActiveScreenshot({ activeDeviceId: activeDevice.id });
    }
  }, [
    activeDevice,
    activeScreenshot.activeDeviceId,
    selectedColorId,
    selectedDeviceId,
    updateActiveScreenshot,
  ]);

  const addScreenshot = () => {
    const newScreenshot: Screenshot = {
      id: generateId(),
      headline: "New Screenshot",
      subheadline: "Add your description here",
      backgroundColor: activeScreenshot.backgroundColor,
      backgroundMode: activeScreenshot.backgroundMode,
      gradientPresetId: activeScreenshot.gradientPresetId,
      textColor: activeScreenshot.textColor,
      headlineX: 50,
      headlineY: 10,
      headlineWidth: 80,
      subheadlineX: 50,
      subheadlineY: 18,
      subheadlineWidth: 80,
      fontFamily: activeScreenshot.fontFamily,
      overlayImages: [],
      devices: activeScreenshot.devices.map((device) =>
        cloneDeviceInstance(device, { id: generateId() }),
      ),
      activeDeviceId: activeScreenshot.devices[0]?.id ?? generateId(),
    };
    newScreenshot.activeDeviceId = newScreenshot.devices[0].id;
    setScreenshots([...screenshots, newScreenshot]);
    setActiveScreenshotId(newScreenshot.id);
  };

  const handleElementMouseDown = (
    e: React.MouseEvent,
    type: "headline" | "subheadline" | "image" | "device",
    screenshotId: string,
    id?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const screenshotElement = (e.currentTarget as HTMLElement).closest(
      "[data-screenshot-card='true']",
    );
    if (screenshotElement instanceof HTMLElement) {
      const rect = screenshotElement.getBoundingClientRect();
      dragContainerSize.current = { width: rect.width, height: rect.height };
    } else if (previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      dragContainerSize.current = { width: rect.width, height: rect.height };
    }

    const targetScreenshot =
      screenshots.find((screenshot) => screenshot.id === screenshotId) ??
      activeScreenshot;

    setIsDragging(true);
    setSelectedElement({ type, id, screenshotId });
    if (activeScreenshotId !== screenshotId) {
      setActiveScreenshotIdState(screenshotId);
    }
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    if (type === "device" && id) {
      updateScreenshotById(screenshotId, { activeDeviceId: id });
      const device = targetScreenshot.devices.find((item) => item.id === id);
      if (device) {
        dragStartElementPos.current = { x: device.x, y: device.y };
      }
    } else if (type === "headline") {
      dragStartElementPos.current = {
        x: targetScreenshot.headlineX,
        y: targetScreenshot.headlineY,
      };
    } else if (type === "subheadline") {
      dragStartElementPos.current = {
        x: targetScreenshot.subheadlineX,
        y: targetScreenshot.subheadlineY,
      };
    } else if (type === "image" && id) {
      const image = targetScreenshot.overlayImages.find((img) => img.id === id);
      if (image) {
        dragStartElementPos.current = { x: image.x, y: image.y };
      }
    }
  };

  const applyDragUpdate = useCallback(() => {
    if (!pendingUpdate.current || !selectedElement) return;

    const { x: newX, y: newY } = pendingUpdate.current;

    if (selectedElement.type === "headline") {
      updateScreenshotById(selectedElement.screenshotId, {
        headlineX: newX,
        headlineY: newY,
      });
    } else if (selectedElement.type === "subheadline") {
      updateScreenshotById(selectedElement.screenshotId, {
        subheadlineX: newX,
        subheadlineY: newY,
      });
    } else if (selectedElement.type === "image" && selectedElement.id) {
      const targetScreenshot = screenshots.find(
        (screenshot) => screenshot.id === selectedElement.screenshotId,
      );
      if (!targetScreenshot) return;

      const updatedImages = targetScreenshot.overlayImages.map((img) =>
        img.id === selectedElement.id ? { ...img, x: newX, y: newY } : img,
      );
      updateScreenshotById(selectedElement.screenshotId, {
        overlayImages: updatedImages,
      });
    } else if (selectedElement.type === "device" && selectedElement.id) {
      const targetScreenshot = screenshots.find(
        (screenshot) => screenshot.id === selectedElement.screenshotId,
      );
      if (!targetScreenshot) return;

      const updatedDevices = targetScreenshot.devices.map((device) =>
        device.id === selectedElement.id ? { ...device, x: newX, y: newY } : device,
      );
      updateScreenshotById(selectedElement.screenshotId, {
        devices: updatedDevices,
      });
    }

    pendingUpdate.current = null;
    rafId.current = null;
  }, [screenshots, selectedElement, updateScreenshotById]);

  const handleElementMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !selectedElement) return;

      const { width, height } = dragContainerSize.current;
      if (width === 0 || height === 0) return;

      const deltaX = ((e.clientX - dragStartPos.current.x) / width) * 100;
      const deltaY = ((e.clientY - dragStartPos.current.y) / height) * 100;

      const newX = dragStartElementPos.current.x + deltaX;
      const newY = dragStartElementPos.current.y + deltaY;

      pendingUpdate.current = { x: newX, y: newY };

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(applyDragUpdate);
      }
    },
    [isDragging, selectedElement, applyDragUpdate],
  );

  const handleElementMouseUp = useCallback(() => {
    setIsDragging(false);
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    if (pendingUpdate.current) {
      applyDragUpdate();
    }
  }, [applyDragUpdate]);

  // Set up global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleElementMouseMove);
      window.addEventListener("mouseup", handleElementMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleElementMouseMove);
      window.removeEventListener("mouseup", handleElementMouseUp);
    };
  }, [isDragging, handleElementMouseMove, handleElementMouseUp]);

  const addOverlayImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const newImage: ImageOverlay = {
            id: generateId(),
            src: result,
            x: 50,
            y: 50,
            width: 30,
            height: 30 / aspectRatio,
            layer: "front",
            rotation: 0,
            shadow: {
              enabled: false,
              color: "#000000",
              blur: 20,
              offsetX: 0,
              offsetY: 10,
            },
          };
          updateActiveScreenshot({
            overlayImages: [...activeScreenshot.overlayImages, newImage],
          });
          setSelectedElement({
            type: "image",
            id: newImage.id,
            screenshotId: activeScreenshot.id,
          });
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const removeOverlayImage = (imageId: string) => {
    const updatedImages = activeScreenshot.overlayImages.filter(
      (img) => img.id !== imageId,
    );
    updateActiveScreenshot({ overlayImages: updatedImages });
    if (
      selectedElement?.type === "image" &&
      selectedElement.screenshotId === activeScreenshot.id &&
      selectedElement.id === imageId
    ) {
      setSelectedElement(null);
    }
  };

  const updateOverlayImageSize = (imageId: string, widthPercent: number) => {
    const image = activeScreenshot.overlayImages.find(
      (img) => img.id === imageId,
    );
    if (!image) return;

    // Use current dimensions to maintain aspect ratio without reloading image
    const aspectRatio = image.width / image.height;

    const updatedImages = activeScreenshot.overlayImages.map((item) =>
      item.id === imageId
        ? {
            ...item,
            width: widthPercent,
            height: widthPercent / aspectRatio,
          }
        : item,
    );
    updateActiveScreenshot({ overlayImages: updatedImages });
  };

  const updateOverlayImageLayer = (
    imageId: string,
    layer: "behind" | "front",
  ) => {
    const updatedImages = activeScreenshot.overlayImages.map((item) =>
      item.id === imageId ? { ...item, layer } : item,
    );
    updateActiveScreenshot({ overlayImages: updatedImages });
  };

  const updateOverlayImageRotation = (imageId: string, rotation: number) => {
    const updatedImages = activeScreenshot.overlayImages.map((item) =>
      item.id === imageId ? { ...item, rotation } : item,
    );
    updateActiveScreenshot({ overlayImages: updatedImages });
  };

  const updateOverlayImageShadow = (
    imageId: string,
    shadow: Partial<ShadowConfig>,
  ) => {
    const updatedImages = activeScreenshot.overlayImages.map((item) =>
      item.id === imageId
        ? { ...item, shadow: { ...item.shadow, ...shadow } }
        : item,
    );
    updateActiveScreenshot({ overlayImages: updatedImages });
  };

  const bringImageForward = (imageId: string) => {
    const images = [...activeScreenshot.overlayImages];
    const index = images.findIndex((img) => img.id === imageId);
    if (index !== -1 && index < images.length - 1) {
      const temp = images[index];
      images[index] = images[index + 1];
      images[index + 1] = temp;
      updateActiveScreenshot({ overlayImages: images });
    }
  };

  const sendImageBackward = (imageId: string) => {
    const images = [...activeScreenshot.overlayImages];
    const index = images.findIndex((img) => img.id === imageId);
    if (index > 0) {
      const temp = images[index];
      images[index] = images[index - 1];
      images[index - 1] = temp;
      updateActiveScreenshot({ overlayImages: images });
    }
  };

  const bringImageToFront = (imageId: string) => {
    const images = [...activeScreenshot.overlayImages];
    const index = images.findIndex((img) => img.id === imageId);
    if (index !== -1 && index < images.length - 1) {
      const [image] = images.splice(index, 1);
      images.push(image);
      updateActiveScreenshot({ overlayImages: images });
    }
  };

  const sendImageToBack = (imageId: string) => {
    const images = [...activeScreenshot.overlayImages];
    const index = images.findIndex((img) => img.id === imageId);
    if (index > 0) {
      const [image] = images.splice(index, 1);
      images.unshift(image);
      updateActiveScreenshot({ overlayImages: images });
    }
  };

  const addDevice = () => {
    const nextDevice = activeDevice
      ? cloneDeviceInstance(activeDevice, {
          id: generateId(),
          x: Math.min(activeDevice.x + 12, 88),
          y: Math.min(activeDevice.y + 4, 70),
        })
      : createDeviceInstance({
          deviceId: selectedDeviceId,
          colorId: selectedColorId,
        });

    updateActiveScreenshot({
      devices: [...activeScreenshot.devices, nextDevice],
      activeDeviceId: nextDevice.id,
    });
    setSelectedElement({
      type: "device",
      id: nextDevice.id,
      screenshotId: activeScreenshot.id,
    });
    setSelectedDeviceIdState(nextDevice.deviceId);
    setSelectedColorIdState(nextDevice.colorId);
  };

  const selectDevice = (deviceId: string) => {
    updateActiveScreenshot({ activeDeviceId: deviceId });
    setSelectedElement({
      type: "device",
      id: deviceId,
      screenshotId: activeScreenshot.id,
    });
  };

  const removeDevice = (deviceId: string) => {
    if (activeScreenshot.devices.length <= 1) return;

    const nextDevices = activeScreenshot.devices.filter(
      (device) => device.id !== deviceId,
    );
    const nextActiveDeviceId =
      activeScreenshot.activeDeviceId === deviceId
        ? nextDevices[Math.max(0, nextDevices.length - 1)].id
        : activeScreenshot.activeDeviceId;

    updateActiveScreenshot({
      devices: nextDevices,
      activeDeviceId: nextActiveDeviceId,
    });

    if (
      selectedElement?.type === "device" &&
      selectedElement.screenshotId === activeScreenshot.id &&
      selectedElement.id === deviceId
    ) {
      setSelectedElement({
        type: "device",
        id: nextActiveDeviceId,
        screenshotId: activeScreenshot.id,
      });
    }
  };

  const bringDeviceForward = (deviceId: string) => {
    const nextDevices = [...activeScreenshot.devices];
    const index = nextDevices.findIndex((device) => device.id === deviceId);
    if (index !== -1 && index < nextDevices.length - 1) {
      const temp = nextDevices[index];
      nextDevices[index] = nextDevices[index + 1];
      nextDevices[index + 1] = temp;
      updateActiveScreenshot({ devices: nextDevices });
    }
  };

  const sendDeviceBackward = (deviceId: string) => {
    const nextDevices = [...activeScreenshot.devices];
    const index = nextDevices.findIndex((device) => device.id === deviceId);
    if (index > 0) {
      const temp = nextDevices[index];
      nextDevices[index] = nextDevices[index - 1];
      nextDevices[index - 1] = temp;
      updateActiveScreenshot({ devices: nextDevices });
    }
  };

  const removeScreenshot = (id: string) => {
    if (screenshots.length <= 1) return;
    const newScreenshots = screenshots.filter((s) => s.id !== id);
    setScreenshots(newScreenshots);
    if (activeScreenshotId === id) {
      setActiveScreenshotId(newScreenshots[0].id);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        updateActiveScreenshot({
          devices: activeScreenshot.devices.map((device) =>
            device.id === activeDevice.id
              ? { ...device, screenshotSrc: result }
              : device,
          ),
        });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const getBackgroundStyle = (screenshot: Screenshot) => {
    if (screenshot.backgroundMode === "gradient") {
      const preset =
        gradientPresets.find((p) => p.id === screenshot.gradientPresetId) ??
        gradientPresets[0];
      return `linear-gradient(180deg, ${preset.from}, ${preset.to})`;
    }
    return screenshot.backgroundColor;
  };

  const handleExport = () => {
    void exportScreenshots({
      screenshots,
      exportSize,
      previewDimensions,
      headlineFontSize,
      subheadlineFontSize,
    });
    setIsStarModalOpen(true);
  };

  /**
   * Resets the editor to default state and clears IndexedDB (and any legacy
   * localStorage data left over from older versions). Cancels pending saves
   * first so a queued debounce doesn't write the pre-reset state back over
   * the cleared store right after we wipe it.
   */
  const resetEditor = async () => {
    cancelPendingSave();
    try {
      await clearAllStorage();
    } catch (err) {
      console.error("Failed to clear IndexedDB during reset:", err);
    }
    const defaultProject = createDefaultProject();
    setProjects([defaultProject]);
    applyProjectToState(defaultProject);
    setIsStarModalOpen(false);
    setSnapshots([]);
  };

  return (
    <EditorContext.Provider
      value={{
        // Project state
        projects,
        activeProjectId,
        activeProject,
        createProject,
        renameProject,
        deleteProject,
        switchProject,

        isFontPickerOpen,
        setIsFontPickerOpen,
        isStarModalOpen,
        setIsStarModalOpen,
        selectedDeviceId,
        setSelectedDeviceId,
        selectedColorId,
        setSelectedColorId,
        exportSizeId,
        setExportSizeId,
        screenshots,
        setScreenshots,
        activeScreenshotId,
        setActiveScreenshotId,
        selectedElement,
        setSelectedElement,
        isDragging,
        headlineFontSize,
        setHeadlineFontSize,
        subheadlineFontSize,
        setSubheadlineFontSize,
        previewDimensions,
        setPreviewDimensions,
        previewRef,
        fileInputRef,
        canvasContainerRef,
        overlayImageInputRef,
        selectedDevice,
        selectedColor,
        activeScreenshot,
        activeDevice,
        exportSize,
        updateActiveScreenshot,
        addScreenshot,
        removeScreenshot,
        handleElementMouseDown,
        handleElementMouseMove,
        handleElementMouseUp,
        addOverlayImage,
        removeOverlayImage,
        updateOverlayImageSize,
        updateOverlayImageLayer,
        updateOverlayImageRotation,
        updateOverlayImageShadow,
        addDevice,
        selectDevice,
        removeDevice,
        bringDeviceForward,
        sendDeviceBackward,
        bringImageForward,
        sendImageBackward,
        bringImageToFront,
        sendImageToBack,
        handleFileUpload,
        handleExport,
        getBackgroundStyle,
        resetEditor,
        // Persistence status
        isSaving,
        lastSaved,
        saveError,
        saveNow,
        // Snapshots
        snapshots,
        refreshSnapshots,
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        // Export / Import
        exportProjectToFile,
        importProjectFromFile,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
};
