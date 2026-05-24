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
  PlatformKey,
  SelectedElement,
  AIProjectConfig,
} from "../types";
import type { BrandFolderContents } from "../lib/ai/brand";
import {
  pickBrandFolder,
  readBrandFolder,
} from "../lib/ai/brand";
import { getProvider, resolveModelForTier } from "../lib/ai/factory";
import {
  generateContentPairs,
  type ContentPair,
} from "../lib/ai/features/content-pair";
import {
  generateTheme,
  type ThemeConfig,
} from "../lib/ai/features/theme";
import { generateFullScreenshot } from "../lib/ai/features/full-screenshot";
import {
  generateListing,
  type ListingConfig,
} from "../lib/ai/features/listing";
import {
  generateStyleSet,
  type StyleSetConfig,
} from "../lib/ai/features/style-set";
import {
  generateImagePrompts,
  type ImagePromptKind,
} from "../lib/ai/features/image-prompts";
import { extractScreenDescription } from "../lib/ai/features/vision";
import { sliceImageBand, sliceImageVertically } from "../lib/ai/image/slice";
import {
  composeEnrichedImagePrompt,
  type ImagePromptPurpose,
} from "../lib/ai/image/compose-prompt";
import { enrichImagePrompt } from "../lib/ai/features/enrich-image-prompt";
import { generateHeroCard } from "../lib/ai/features/hero-card";
import type {
  ImageModelId,
  ImageResolution,
} from "../lib/ai/image-provider";
import { getImageProvider } from "../lib/ai/image/factory";
import {
  generateLayout,
  type LayoutPresetId,
} from "../lib/ai/features/layout";
import { POSITION_PRESET_SETTINGS } from "../components/RightSidebar/position-presets-data";
import {
  devices,
  exportSizes,
  getPlatform,
  gradientPresets,
  inferPlatformFromDevice,
} from "../constants";
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
  computeSnap,
  type DragGuides,
} from "../components/CanvasPreview/snap-guides";
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

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const m = hex.match(/^#?([a-f0-9]{6})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
};

interface EditorContextType {
  // Project state
  projects: Project[];
  activeProjectId: string;
  activeProject: Project;
  createProject: (name: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => Promise<void>;
  switchProject: (id: string) => void;
  duplicateProjectAsPlatform: (sourceId: string, platform: PlatformKey) => void;

  // State
  isFontPickerOpen: boolean;
  setIsFontPickerOpen: (open: boolean) => void;
  exportToast: { message: string; tone: "success" | "error" } | null;
  dismissExportToast: () => void;
  // AI / brand context (per-project)
  aiConfig: AIProjectConfig;
  updateAIConfig: (updates: Partial<AIProjectConfig>) => void;
  brandFolderContents: BrandFolderContents | null;
  isLoadingBrandFolder: boolean;
  brandFolderError: string | null;
  pickAndLoadBrandFolder: () => Promise<void>;
  clearBrandFolder: () => void;

  // AI actions
  isGeneratingContent: boolean;
  contentSuggestions: ContentPair[];
  contentError: string | null;
  generateContentSuggestions: () => Promise<void>;
  applyContentSuggestion: (pair: ContentPair) => void;
  dismissContentSuggestions: () => void;

  isGeneratingTheme: boolean;
  themeSuggestion: ThemeConfig | null;
  themeError: string | null;
  generateThemeSuggestion: () => Promise<void>;
  applyThemeSuggestion: () => void;
  dismissThemeSuggestion: () => void;

  isGeneratingLayout: boolean;
  layoutSuggestion: LayoutPresetId | null;
  layoutError: string | null;
  generateLayoutSuggestion: () => Promise<void>;
  applyLayoutSuggestion: () => void;
  dismissLayoutSuggestion: () => void;

  // Vision extraction — surfaces whether the active screenshot has been
  // "seen" by the AI yet, so the user can verify the context being used.
  isExtractingScreenDescription: boolean;
  refreshScreenDescription: () => Promise<void>;

  isGeneratingFullScreenshot: boolean;
  generateFullScreenshotError: string | null;
  generateFullScreenshotFromIdea: (idea: string) => Promise<boolean>;
  clearGenerateFullScreenshotError: () => void;

  // Hero panel — text-only cover screenshot with AI background, no devices.
  isGeneratingHero: boolean;
  generateHeroError: string | null;
  generateHero: (input: {
    angle?: string;
    model: "nano-banana-pro" | "codex-gpt-image";
    resolution: "1K" | "2K" | "4K";
  }) => Promise<boolean>;
  clearGenerateHeroError: () => void;

  // Batch listing — generate N coherent panels in one AI call.
  // Apply/generate functions return Promise<boolean> so callers can close
  // their UI only on success — relying on a closure-captured error state
  // races with the React render cycle and falsely closes on failure.
  isGeneratingListing: boolean;
  generateListingError: string | null;
  generateListingFromIdea: (input: {
    idea: string;
    panelCount: number;
    mode: "replace" | "append";
  }) => Promise<boolean>;
  clearGenerateListingError: () => void;

  // AI image generation (Nano Banana / GPT-Image via Codex) for overlays and
  // backgrounds. Single in-flight job at a time, error is per-attempt.
  isGeneratingAIImage: boolean;
  generateAIImageError: string | null;
  generateAIImage: (input: {
    prompt: string;
    model: "nano-banana-pro" | "codex-gpt-image";
    resolution: "1K" | "2K" | "4K";
    target: "overlay" | "background";
  }) => Promise<boolean>;
  clearGenerateAIImageError: () => void;
  clearBackgroundImage: () => void;

  // Listing-wide styling. Each takes the whole screenshot set into account.
  isStyleingSet: boolean;
  styleSetError: string | null;
  applyCoherentThemeAcrossSet: (steer?: string) => Promise<boolean>;
  applySpanningImageAcrossSet: (input: {
    prompt: string;
    model: "nano-banana-pro" | "codex-gpt-image";
    resolution: "1K" | "2K" | "4K";
  }) => Promise<boolean>;
  applyAccentOverlaysAcrossSet: (input: {
    promptHint?: string;
    model: "nano-banana-pro" | "codex-gpt-image";
    resolution: "1K" | "2K" | "4K";
  }) => Promise<boolean>;
  applySpanningOverlayAcrossSet: (input: {
    prompt: string;
    model: "nano-banana-pro" | "codex-gpt-image";
    resolution: "1K" | "2K" | "4K";
    startPanelIndex: number;
    endPanelIndex: number;
    /** 0-100, percent of panel height the band occupies. */
    bandHeightPercent: number;
    /** Where vertically the band sits on each panel. */
    verticalAnchor: "top" | "middle" | "bottom";
    /** Sits behind devices or in front. Behind is friendlier for text. */
    layer: "behind" | "front";
  }) => Promise<boolean>;
  clearStyleSetError: () => void;

  // AI-suggested image prompts. Single in-flight at a time; the modal
  // requesting suggestions controls which `kind` (spanning / panel /
  // overlay) to ask for.
  isSuggestingImagePrompts: boolean;
  imagePromptSuggestions: string[];
  imagePromptSuggestionsError: string | null;
  suggestImagePrompts: (kind: ImagePromptKind) => Promise<void>;
  clearImagePromptSuggestions: () => void;
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
  /** Active alignment guides keyed by screenshot id, populated while dragging. */
  dragGuides: DragGuides;
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
  // Undefined when the active screenshot is a hero (no devices).
  activeDevice: DeviceInstance | undefined;
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

  // Undo (Ctrl/Cmd+Z) — pops the last change to the active project's editor state.
  undo: () => void;
  canUndo: boolean;
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
  const [exportToast, setExportToast] = useState<
    { message: string; tone: "success" | "error" } | null
  >(null);
  const dismissExportToast = useCallback(() => setExportToast(null), []);

  // AI / brand context — sourced from activeProject.ai, but folder contents
  // live in transient state because they're not worth re-reading on every
  // re-render and they're big (potentially many KB of markdown).
  const [brandFolderContents, setBrandFolderContents] =
    useState<BrandFolderContents | null>(null);
  const [isLoadingBrandFolder, setIsLoadingBrandFolder] = useState(false);
  const [brandFolderError, setBrandFolderError] = useState<string | null>(null);

  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [contentSuggestions, setContentSuggestions] = useState<ContentPair[]>([]);
  const [contentError, setContentError] = useState<string | null>(null);

  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
  const [themeSuggestion, setThemeSuggestion] = useState<ThemeConfig | null>(
    null,
  );
  const [themeError, setThemeError] = useState<string | null>(null);

  const [isGeneratingLayout, setIsGeneratingLayout] = useState(false);
  const [layoutSuggestion, setLayoutSuggestion] =
    useState<LayoutPresetId | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const [isGeneratingFullScreenshot, setIsGeneratingFullScreenshot] =
    useState(false);
  const [generateFullScreenshotError, setGenerateFullScreenshotError] =
    useState<string | null>(null);

  const [isGeneratingListing, setIsGeneratingListing] = useState(false);
  const [generateListingError, setGenerateListingError] = useState<string | null>(
    null,
  );

  const [isGeneratingHero, setIsGeneratingHero] = useState(false);
  const [generateHeroError, setGenerateHeroError] = useState<string | null>(null);

  const [isGeneratingAIImage, setIsGeneratingAIImage] = useState(false);
  const [generateAIImageError, setGenerateAIImageError] = useState<string | null>(
    null,
  );

  const [isStyleingSet, setIsStyleingSet] = useState(false);
  const [styleSetError, setStyleSetError] = useState<string | null>(null);

  const [isSuggestingImagePrompts, setIsSuggestingImagePrompts] = useState(false);
  const [imagePromptSuggestions, setImagePromptSuggestions] = useState<string[]>(
    [],
  );
  const [imagePromptSuggestionsError, setImagePromptSuggestionsError] =
    useState<string | null>(null);
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
  const [dragGuides, setDragGuides] = useState<DragGuides>({});
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
        format: "prestige-project",
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
      a.download = `${safeName || "project"}.prestige.json`;
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
      if (raw?.format !== "prestige-project" || !raw.project) {
        throw new Error("Selected file is not a Prestige project export.");
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

  // --- AI / brand context -------------------------------------------------
  const aiConfig: AIProjectConfig = activeProject.ai ?? {};

  const updateAIConfig = useCallback(
    (updates: Partial<AIProjectConfig>) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProjectId
            ? {
                ...p,
                ai: { ...(p.ai ?? {}), ...updates },
                updatedAt: Date.now(),
              }
            : p,
        ),
      );
    },
    [activeProjectId],
  );

  // Re-read the brand folder whenever the active project's path changes.
  // Folder contents are transient (not persisted), only the path is.
  useEffect(() => {
    const path = activeProject.ai?.brandFolderPath;
    if (!path) {
      setBrandFolderContents(null);
      setBrandFolderError(null);
      return;
    }
    let cancelled = false;
    setIsLoadingBrandFolder(true);
    setBrandFolderError(null);
    (async () => {
      try {
        const contents = await readBrandFolder(path);
        if (!cancelled) setBrandFolderContents(contents);
      } catch (err) {
        if (!cancelled) {
          setBrandFolderContents(null);
          setBrandFolderError(
            err instanceof Error ? err.message : String(err),
          );
        }
      } finally {
        if (!cancelled) setIsLoadingBrandFolder(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProject.ai?.brandFolderPath]);

  const pickAndLoadBrandFolder = useCallback(async () => {
    try {
      const picked = await pickBrandFolder();
      if (!picked) return;
      updateAIConfig({ brandFolderPath: picked });
    } catch (err) {
      setBrandFolderError(err instanceof Error ? err.message : String(err));
    }
  }, [updateAIConfig]);

  const clearBrandFolder = useCallback(() => {
    updateAIConfig({ brandFolderPath: undefined });
    setBrandFolderContents(null);
    setBrandFolderError(null);
  }, [updateAIConfig]);

  // Per-screenshot job counter for vision extractions. We increment on every
  // new request and only commit the result if it matches the latest counter
  // for that screenshot — this avoids a stale result from a slower previous
  // request clobbering a newer one (e.g. user uploads image-A, then quickly
  // swaps to image-B before A's vision returns).
  const visionJobIdRef = useRef<Map<string, number>>(new Map());
  // Tracks in-flight vision jobs by ID so duplicate ensure() calls coalesce.
  const visionInFlightRef = useRef<Map<number, Promise<string | null>>>(
    new Map(),
  );
  const [isExtractingScreenDescription, setIsExtractingScreenDescription] =
    useState(false);

  /**
   * Run vision on a specific (screenshotId, imageDataUrl) pair and cache the
   * description onto that screenshot. The image URL is passed in explicitly
   * so callers (like handleFileUpload) don't race with React state updates.
   */
  const extractAndCacheScreenDescription = useCallback(
    async (
      screenshotId: string,
      imageDataUrl: string,
    ): Promise<string | null> => {
      const jobId = (visionJobIdRef.current.get(screenshotId) ?? 0) + 1;
      visionJobIdRef.current.set(screenshotId, jobId);

      setIsExtractingScreenDescription(true);
      const work = (async () => {
        try {
          const providerId = activeProject.ai?.provider ?? "claude";
          const provider = getProvider(providerId);
          const result = await extractScreenDescription({
            provider,
            model: resolveModelForTier(providerId, "cheap"),
            imageDataUrl,
          });
          if (!result.description) return null;
          // Only commit if this is still the latest job for the screenshot.
          if (visionJobIdRef.current.get(screenshotId) !== jobId) return null;
          setScreenshotsState((prev) =>
            prev.map((s) =>
              s.id === screenshotId
                ? { ...s, screenDescription: result.description }
                : s,
            ),
          );
          return result.description;
        } catch (err) {
          console.warn("[vision] extraction failed:", err);
          return null;
        } finally {
          visionInFlightRef.current.delete(jobId);
          // Clear the spinner only when no other vision jobs are running.
          if (visionInFlightRef.current.size === 0) {
            setIsExtractingScreenDescription(false);
          }
        }
      })();
      visionInFlightRef.current.set(jobId, work);
      return work;
    },
    [activeProject.ai],
  );

  /**
   * Ensure the active screenshot has a vision-extracted description. Idempotent
   * and lazy:
   *   - If a description is already cached, returns it immediately.
   *   - If no screen image is uploaded yet, returns null.
   *   - Otherwise runs the vision pipeline, caches the result on the
   *     Screenshot, and returns it.
   *
   * Used by every AI feature action so existing screenshots — uploaded
   * before vision existed, or whose description was invalidated — still get
   * described on first AI use.
   */
  const ensureScreenDescriptionForActiveScreenshot = useCallback(
    async (): Promise<string | null> => {
      const liveScreenshot =
        screenshots.find((s) => s.id === activeScreenshotId) ?? screenshots[0];
      if (!liveScreenshot) return null;
      if (liveScreenshot.screenDescription?.trim()) {
        return liveScreenshot.screenDescription;
      }
      const activeDeviceImg = liveScreenshot.devices.find(
        (d) => d.id === liveScreenshot.activeDeviceId,
      )?.screenshotSrc;
      const anyImg =
        activeDeviceImg ??
        liveScreenshot.devices.find((d) => !!d.screenshotSrc)?.screenshotSrc;
      if (!anyImg) return null;
      return extractAndCacheScreenDescription(liveScreenshot.id, anyImg);
    },
    [activeScreenshotId, screenshots, extractAndCacheScreenDescription],
  );

  /**
   * Force re-extraction of the active screenshot's description. Clears the
   * cached value first so ensureScreenDescriptionForActiveScreenshot will
   * actually fire vision instead of short-circuiting.
   */
  const refreshScreenDescription = useCallback(async () => {
    setScreenshotsState((prev) =>
      prev.map((s) =>
        s.id === activeScreenshotId
          ? { ...s, screenDescription: undefined }
          : s,
      ),
    );
    await ensureScreenDescriptionForActiveScreenshot();
  }, [activeScreenshotId, ensureScreenDescriptionForActiveScreenshot]);

  const generateContentSuggestions = useCallback(async () => {
    setIsGeneratingContent(true);
    setContentError(null);
    setContentSuggestions([]);
    try {
      // Lazy vision: extract screen description from the uploaded image
      // before generating, so the AI knows WHAT screen it's writing copy for.
      // No-op if a description is already cached or no image was uploaded.
      const screenDescription = await ensureScreenDescriptionForActiveScreenshot();
      const providerId = activeProject.ai?.provider ?? "claude";
      const provider = getProvider(providerId);
      // Read the live active screenshot off local state (`screenshots` +
      // `activeScreenshotId`), not the per-project `activeProject` snapshot,
      // since the user may have edited copy that hasn't been folded back into
      // the project yet.
      const liveScreenshot =
        screenshots.find((s) => s.id === activeScreenshotId) ?? screenshots[0];
      const result = await generateContentPairs({
        provider,
        model: resolveModelForTier(providerId, "cheap"),
        activeScreenshot: liveScreenshot,
        brand: {
          brandName: activeProject.ai?.brandName,
          audience: activeProject.ai?.audience,
          voice: activeProject.ai?.voice,
          keyFeature: activeProject.ai?.keyFeature,
          folder: brandFolderContents,
          screenDescription:
            screenDescription ?? liveScreenshot.screenDescription,
        },
      });
      setContentSuggestions(result.pairs);
      if (result.pairs.length === 0) {
        setContentError(
          `Could not parse content pairs from response. Raw output:\n${result.raw.slice(0, 200)}`,
        );
      }
    } catch (err) {
      setContentError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingContent(false);
    }
  }, [
    activeProject.ai,
    activeScreenshotId,
    brandFolderContents,
    screenshots,
    ensureScreenDescriptionForActiveScreenshot,
  ]);

  const applyContentSuggestion = useCallback(
    (pair: ContentPair) => {
      setScreenshotsState((prev) =>
        prev.map((s) =>
          s.id === activeScreenshotId
            ? { ...s, headline: pair.headline, subheadline: pair.subheadline }
            : s,
        ),
      );
    },
    [activeScreenshotId],
  );

  const dismissContentSuggestions = useCallback(() => {
    setContentSuggestions([]);
    setContentError(null);
  }, []);

  const generateThemeSuggestion = useCallback(async () => {
    setIsGeneratingTheme(true);
    setThemeError(null);
    setThemeSuggestion(null);
    try {
      const screenDescription = await ensureScreenDescriptionForActiveScreenshot();
      const providerId = activeProject.ai?.provider ?? "claude";
      const provider = getProvider(providerId);
      const liveScreenshot =
        screenshots.find((s) => s.id === activeScreenshotId) ?? screenshots[0];
      const result = await generateTheme({
        provider,
        model: resolveModelForTier(providerId, "default"),
        brand: {
          brandName: activeProject.ai?.brandName,
          audience: activeProject.ai?.audience,
          voice: activeProject.ai?.voice,
          keyFeature: activeProject.ai?.keyFeature,
          folder: brandFolderContents,
          screenDescription:
            screenDescription ?? liveScreenshot.screenDescription,
        },
        currentFont: liveScreenshot.fontFamily,
        currentBackground: liveScreenshot.backgroundColor,
      });
      if (!result.theme) {
        setThemeError(
          `Could not parse theme from response. Raw output:\n${result.raw.slice(0, 200)}`,
        );
        return;
      }
      setThemeSuggestion(result.theme);
    } catch (err) {
      setThemeError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingTheme(false);
    }
  }, [activeProject.ai, activeScreenshotId, brandFolderContents, screenshots, ensureScreenDescriptionForActiveScreenshot]);

  const applyThemeSuggestion = useCallback(() => {
    if (!themeSuggestion) return;
    const t = themeSuggestion;
    setScreenshotsState((prev) =>
      prev.map((s) =>
        s.id === activeScreenshotId
          ? {
              ...s,
              fontFamily: t.fontFamily,
              backgroundMode: t.backgroundMode,
              backgroundColor: t.backgroundColor,
              customGradient: t.customGradient,
              // Clear preset so the custom gradient (or new solid) wins.
              gradientPresetId:
                t.backgroundMode === "gradient" ? null : s.gradientPresetId,
              textColor: t.textColor,
            }
          : s,
      ),
    );
    setThemeSuggestion(null);
  }, [themeSuggestion, activeScreenshotId]);

  const dismissThemeSuggestion = useCallback(() => {
    setThemeSuggestion(null);
    setThemeError(null);
  }, []);

  const generateLayoutSuggestion = useCallback(async () => {
    setIsGeneratingLayout(true);
    setLayoutError(null);
    setLayoutSuggestion(null);
    try {
      const screenDescription = await ensureScreenDescriptionForActiveScreenshot();
      const providerId = activeProject.ai?.provider ?? "claude";
      const provider = getProvider(providerId);
      const liveScreenshot =
        screenshots.find((s) => s.id === activeScreenshotId) ?? screenshots[0];
      const liveDevice =
        liveScreenshot.devices.find(
          (d) => d.id === liveScreenshot.activeDeviceId,
        ) ?? liveScreenshot.devices[0];
      const result = await generateLayout({
        provider,
        model: resolveModelForTier(providerId, "default"),
        brand: {
          brandName: activeProject.ai?.brandName,
          audience: activeProject.ai?.audience,
          voice: activeProject.ai?.voice,
          keyFeature: activeProject.ai?.keyFeature,
          folder: brandFolderContents,
          screenDescription:
            screenDescription ?? liveScreenshot.screenDescription,
        },
        currentLayout: `style=${liveDevice.style}, scale=${liveDevice.scale}, y=${liveDevice.y}, rotation=${liveDevice.rotation}`,
      });
      if (!result.layout) {
        setLayoutError(
          `Could not parse layout from response. Raw output:\n${result.raw.slice(0, 200)}`,
        );
        return;
      }
      setLayoutSuggestion(result.layout);
    } catch (err) {
      setLayoutError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingLayout(false);
    }
  }, [activeProject.ai, activeScreenshotId, brandFolderContents, screenshots, ensureScreenDescriptionForActiveScreenshot]);

  const applyLayoutSuggestion = useCallback(() => {
    if (!layoutSuggestion) return;
    const settings = POSITION_PRESET_SETTINGS[layoutSuggestion];
    if (!settings) return;
    setScreenshotsState((prev) =>
      prev.map((s) =>
        s.id === activeScreenshotId
          ? {
              ...s,
              devices: s.devices.map((d) =>
                d.id === s.activeDeviceId
                  ? {
                      ...d,
                      scale: settings.scale,
                      y: settings.y,
                      rotation: settings.rotation,
                      style: settings.style,
                      // Use preset 3D values when present; otherwise keep
                      // whatever was previously set (avoids stomping good
                      // values when switching to a flat preset).
                      rotateY: settings.rotateY ?? d.rotateY,
                      rotateX: settings.rotateX ?? d.rotateX,
                    }
                  : d,
              ),
            }
          : s,
      ),
    );
    setLayoutSuggestion(null);
  }, [layoutSuggestion, activeScreenshotId]);

  const dismissLayoutSuggestion = useCallback(() => {
    setLayoutSuggestion(null);
    setLayoutError(null);
  }, []);

  const generateFullScreenshotFromIdea = useCallback(
    async (idea: string) => {
      const trimmed = idea.trim();
      if (!trimmed) return false;
      setIsGeneratingFullScreenshot(true);
      setGenerateFullScreenshotError(null);
      try {
        const providerId = activeProject.ai?.provider ?? "claude";
        const provider = getProvider(providerId);
        const result = await generateFullScreenshot({
          provider,
          model: resolveModelForTier(providerId, "default"),
          idea: trimmed,
          brand: {
            brandName: activeProject.ai?.brandName,
            audience: activeProject.ai?.audience,
            voice: activeProject.ai?.voice,
            keyFeature: activeProject.ai?.keyFeature,
            folder: brandFolderContents,
            // No screenDescription here — the user's `idea` already plays
            // that role for a freshly-generated screenshot.
          },
        });
        if (!result.config) {
          setGenerateFullScreenshotError(
            `AI returned an unparseable response. Raw output:\n${result.raw.slice(0, 200)}`,
          );
          return false;
        }
        // Build a fresh screenshot using existing layout defaults, then
        // overlay the AI-chosen marketing/appearance fields.
        const base = createDefaultScreenshot(
          selectedDeviceId,
          selectedColorId,
        );
        const newScreenshot: Screenshot = {
          ...base,
          id: generateId(),
          headline: result.config.headline,
          subheadline: result.config.subheadline,
          backgroundMode: result.config.backgroundMode,
          backgroundColor: result.config.backgroundColor,
          customGradient: result.config.customGradient,
          textColor: result.config.textColor,
          fontFamily: result.config.fontFamily,
          // Carry over the user's existing device choices.
          devices: base.devices,
          activeDeviceId: base.activeDeviceId,
        };
        setScreenshotsState((prev) => [...prev, newScreenshot]);
        setActiveScreenshotIdState(newScreenshot.id);
        setSelectedElement(null);
        return true;
      } catch (err) {
        setGenerateFullScreenshotError(
          err instanceof Error ? err.message : String(err),
        );
        return false;
      } finally {
        setIsGeneratingFullScreenshot(false);
      }
    },
    [
      activeProject.ai,
      brandFolderContents,
      selectedColorId,
      selectedDeviceId,
    ],
  );

  const clearGenerateFullScreenshotError = useCallback(() => {
    setGenerateFullScreenshotError(null);
  }, []);

  // Build screenshots from a listing config: one shared theme + per-panel
  // copy. Devices come from the current active screenshot's device set so
  // the user keeps their device/color picks.
  const buildScreenshotsFromListing = useCallback(
    (config: ListingConfig): Screenshot[] => {
      const baseTemplate = createDefaultScreenshot(
        selectedDeviceId,
        selectedColorId,
      );
      // Source devices from the current active screenshot if present, else
      // from the freshly-built template. Each new panel gets its own cloned
      // device instances so they can be edited independently per panel.
      const currentActive =
        screenshots.find((s) => s.id === activeScreenshotId) ?? screenshots[0];
      const templateDevices =
        currentActive?.devices && currentActive.devices.length > 0
          ? currentActive.devices
          : baseTemplate.devices;
      return config.panels.map((panel) => {
        const clonedDevices = templateDevices.map((d) =>
          cloneDeviceInstance(d, { id: generateId() }),
        );
        return {
          ...baseTemplate,
          id: generateId(),
          headline: panel.headline,
          subheadline: panel.subheadline,
          backgroundMode: config.theme.backgroundMode,
          backgroundColor: config.theme.backgroundColor,
          customGradient: config.theme.customGradient ?? undefined,
          textColor: config.theme.textColor,
          fontFamily: config.theme.fontFamily,
          gradientPresetId:
            config.theme.backgroundMode === "gradient" ? null : baseTemplate.gradientPresetId,
          devices: clonedDevices,
          activeDeviceId: clonedDevices[0]?.id ?? baseTemplate.activeDeviceId,
        };
      });
    },
    [activeScreenshotId, screenshots, selectedColorId, selectedDeviceId],
  );

  const generateListingFromIdea = useCallback(
    async ({
      idea,
      panelCount,
      mode,
    }: {
      idea: string;
      panelCount: number;
      mode: "replace" | "append";
    }) => {
      // Idea is optional when brand context exists; the listing module will
      // error if BOTH are empty. Don't early-return here on empty idea.
      const trimmed = idea.trim();
      // Clamp to a sane range; UI also enforces but defense-in-depth.
      const count = Math.max(1, Math.min(10, Math.floor(panelCount)));
      setIsGeneratingListing(true);
      setGenerateListingError(null);
      try {
        const providerId = activeProject.ai?.provider ?? "claude";
        const provider = getProvider(providerId);
        const result = await generateListing({
          provider,
          model: resolveModelForTier(providerId, "default"),
          idea: trimmed,
          panelCount: count,
          brand: {
            brandName: activeProject.ai?.brandName,
            audience: activeProject.ai?.audience,
            voice: activeProject.ai?.voice,
            keyFeature: activeProject.ai?.keyFeature,
            folder: brandFolderContents,
          },
        });
        if (!result.config || result.config.panels.length === 0) {
          setGenerateListingError(
            `AI returned an unparseable response. Raw output:\n${result.raw.slice(0, 200)}`,
          );
          return false;
        }
        const newScreenshots = buildScreenshotsFromListing(result.config);
        if (newScreenshots.length === 0) {
          setGenerateListingError("AI returned no usable panels.");
          return false;
        }
        if (mode === "replace") {
          setScreenshotsState(newScreenshots);
          setActiveScreenshotIdState(newScreenshots[0].id);
        } else {
          setScreenshotsState((prev) => [...prev, ...newScreenshots]);
          setActiveScreenshotIdState(newScreenshots[0].id);
        }
        setSelectedElement(null);
        return true;
      } catch (err) {
        setGenerateListingError(
          err instanceof Error ? err.message : String(err),
        );
        return false;
      } finally {
        setIsGeneratingListing(false);
      }
    },
    [
      activeProject.ai,
      brandFolderContents,
      buildScreenshotsFromListing,
    ],
  );

  const clearGenerateListingError = useCallback(() => {
    setGenerateListingError(null);
  }, []);

  // Load a data URL through an Image so we can derive aspect ratio for the
  // overlay placement.
  const loadImageAspect = (dataUrl: string): Promise<number> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img.width / Math.max(1, img.height));
      img.onerror = () =>
        reject(new Error("Failed to decode generated image"));
      img.src = dataUrl;
    });

  /**
   * Build the final image prompt:
   *   1. Compose a structured brief locally (palette, brand, composition).
   *   2. Try to AI-rewrite it into a polished single-paragraph prompt via
   *      the cheap-tier text provider.
   *   3. Fall back to the raw brief if the rewrite fails — image-gen
   *      keeps working even if the text provider is misconfigured.
   */
  const buildImagePrompt = useCallback(
    async (input: {
      userPrompt: string;
      purpose: ImagePromptPurpose;
      spanPanelCount?: number;
    }): Promise<string> => {
      const brief = composeEnrichedImagePrompt({
        userPrompt: input.userPrompt,
        purpose: input.purpose,
        panels: screenshots,
        brand: {
          brandName: activeProject.ai?.brandName,
          audience: activeProject.ai?.audience,
          voice: activeProject.ai?.voice,
          keyFeature: activeProject.ai?.keyFeature,
          folder: brandFolderContents,
        },
        spanPanelCount: input.spanPanelCount,
      });
      const providerId = activeProject.ai?.provider ?? "claude";
      try {
        const textProvider = getProvider(providerId);
        const result = await enrichImagePrompt({
          provider: textProvider,
          model: resolveModelForTier(providerId, "cheap"),
          brief,
          purpose: input.purpose,
        });
        console.log(
          `[image-gen] AI-rewritten prompt (${result.durationMs}ms):\n${result.prompt}`,
        );
        return result.prompt;
      } catch (err) {
        console.warn(
          "[image-gen] AI prompt rewrite failed, falling back to structured brief:",
          err,
        );
        return brief;
      }
    },
    [activeProject.ai, brandFolderContents, screenshots],
  );

  const generateHero = useCallback(
    async ({
      angle,
      model,
      resolution,
    }: {
      angle?: string;
      model: ImageModelId;
      resolution: ImageResolution;
    }): Promise<boolean> => {
      setIsGeneratingHero(true);
      setGenerateHeroError(null);
      try {
        const providerId = activeProject.ai?.provider ?? "claude";
        const textProvider = getProvider(providerId);
        const heroResult = await generateHeroCard({
          provider: textProvider,
          model: resolveModelForTier(providerId, "default"),
          angle,
          brand: {
            brandName: activeProject.ai?.brandName,
            audience: activeProject.ai?.audience,
            voice: activeProject.ai?.voice,
            keyFeature: activeProject.ai?.keyFeature,
            folder: brandFolderContents,
          },
        });
        if (!heroResult.config) {
          setGenerateHeroError(
            `AI couldn't parse a hero. Raw:\n${heroResult.raw.slice(0, 200)}`,
          );
          return false;
        }
        const { headline, subheadline, imagePrompt, fontFamily } =
          heroResult.config;

        // Background image via the same brand-aware pipeline.
        const imageProvider = getImageProvider(model);
        const finalPrompt = await buildImagePrompt({
          userPrompt: imagePrompt,
          purpose: "panel-background",
        });
        const imageResult = await imageProvider.generate({
          prompt: finalPrompt,
          resolution,
        });

        // Empty devices + isHero flag = no device chrome rendered.
        const base = createDefaultScreenshot(selectedDeviceId, selectedColorId);
        const heroScreenshot: Screenshot = {
          ...base,
          id: generateId(),
          isHero: true,
          headline,
          subheadline,
          fontFamily,
          backgroundMode: "image",
          backgroundImageSrc: imageResult.dataUrl,
          backgroundImageOpacity: 1,
          headlineX: 50,
          headlineY: 45,
          headlineWidth: 86,
          subheadlineX: 50,
          subheadlineY: 58,
          subheadlineWidth: 80,
          devices: [],
          activeDeviceId: "",
          overlayImages: [],
        };
        // Heroes lead a listing — prepend so the user sees it first.
        setScreenshotsState((prev) => [heroScreenshot, ...prev]);
        setActiveScreenshotIdState(heroScreenshot.id);
        setSelectedElement(null);
        return true;
      } catch (err) {
        setGenerateHeroError(
          err instanceof Error ? err.message : String(err),
        );
        return false;
      } finally {
        setIsGeneratingHero(false);
      }
    },
    [
      activeProject.ai,
      brandFolderContents,
      buildImagePrompt,
      selectedColorId,
      selectedDeviceId,
    ],
  );

  const clearGenerateHeroError = useCallback(() => {
    setGenerateHeroError(null);
  }, []);

  const generateAIImage = useCallback(
    async ({
      prompt,
      model,
      resolution,
      target,
    }: {
      prompt: string;
      model: ImageModelId;
      resolution: ImageResolution;
      target: "overlay" | "background";
    }) => {
      if (!prompt.trim()) return false;
      setIsGeneratingAIImage(true);
      setGenerateAIImageError(null);
      try {
        const provider = getImageProvider(model);
        // Compose brand-aware brief, AI-rewrite into a polished prompt,
        // then send to the image API.
        const finalPrompt = await buildImagePrompt({
          userPrompt: prompt,
          purpose:
            target === "background" ? "panel-background" : "overlay-accent",
        });
        const result = await provider.generate({
          prompt: finalPrompt,
          resolution,
        });
        const targetScreenshotId = activeScreenshotId;

        if (target === "background") {
          setScreenshotsState((prev) =>
            prev.map((s) =>
              s.id === targetScreenshotId
                ? {
                    ...s,
                    backgroundMode: "image",
                    backgroundImageSrc: result.dataUrl,
                  }
                : s,
            ),
          );
        } else {
          const aspect = await loadImageAspect(result.dataUrl);
          const overlay: ImageOverlay = {
            id: generateId(),
            src: result.dataUrl,
            x: 50,
            y: 50,
            width: 30,
            height: 30 / aspect,
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
          setScreenshotsState((prev) =>
            prev.map((s) =>
              s.id === targetScreenshotId
                ? { ...s, overlayImages: [...s.overlayImages, overlay] }
                : s,
            ),
          );
          setSelectedElement({
            type: "image",
            id: overlay.id,
            screenshotId: targetScreenshotId,
          });
        }
        return true;
      } catch (err) {
        setGenerateAIImageError(
          err instanceof Error ? err.message : String(err),
        );
        return false;
      } finally {
        setIsGeneratingAIImage(false);
      }
    },
    [activeScreenshotId, buildImagePrompt],
  );

  const clearGenerateAIImageError = useCallback(() => {
    setGenerateAIImageError(null);
  }, []);

  const clearBackgroundImage = useCallback(() => {
    const targetId = activeScreenshotId;
    setScreenshotsState((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? {
              ...s,
              // Always fall back to solid — we don't track what mode the
              // user was on before switching to image. They can re-pick
              // gradient from the BackgroundPicker if that's what they want.
              backgroundMode: "solid",
              backgroundImageSrc: undefined,
            }
          : s,
      ),
    );
  }, [activeScreenshotId]);

  // --- Listing-wide AI styling ------------------------------------------
  const applyStyleSetConfig = useCallback(
    (config: StyleSetConfig) => {
      setScreenshotsState((prev) =>
        prev.map((s, i) => {
          const panel = config.panels[i];
          if (!panel) return s;
          return {
            ...s,
            fontFamily: config.fontFamily,
            backgroundMode: panel.backgroundMode,
            backgroundColor: panel.backgroundColor,
            customGradient: panel.customGradient ?? undefined,
            // Clear preset so the per-panel custom gradient wins.
            gradientPresetId:
              panel.backgroundMode === "gradient" ? null : s.gradientPresetId,
            textColor: panel.textColor,
            // Drop any prior bg image — coherent theming uses solid/gradient.
            backgroundImageSrc: undefined,
          };
        }),
      );
    },
    [],
  );

  const applyCoherentThemeAcrossSet = useCallback(
    async (steer?: string) => {
      setIsStyleingSet(true);
      setStyleSetError(null);
      try {
        const providerId = activeProject.ai?.provider ?? "claude";
        const provider = getProvider(providerId);
        const result = await generateStyleSet({
          provider,
          model: resolveModelForTier(providerId, "default"),
          panelHeadlines: screenshots.map((s) => s.headline),
          brand: {
            brandName: activeProject.ai?.brandName,
            audience: activeProject.ai?.audience,
            voice: activeProject.ai?.voice,
            keyFeature: activeProject.ai?.keyFeature,
            folder: brandFolderContents,
          },
          steer,
        });
        if (!result.config) {
          setStyleSetError(
            `AI returned an unparseable response. Raw output:\n${result.raw.slice(0, 200)}`,
          );
          return false;
        }
        applyStyleSetConfig(result.config);
        return true;
      } catch (err) {
        setStyleSetError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setIsStyleingSet(false);
      }
    },
    [
      activeProject.ai,
      applyStyleSetConfig,
      brandFolderContents,
      screenshots,
    ],
  );

  const applySpanningImageAcrossSet = useCallback(
    async ({
      prompt,
      model,
      resolution,
    }: {
      prompt: string;
      model: ImageModelId;
      resolution: ImageResolution;
    }) => {
      if (!prompt.trim()) {
        setStyleSetError("Prompt is required for spanning image.");
        return false;
      }
      const panelCount = screenshots.length;
      if (panelCount === 0) return false;
      setIsStyleingSet(true);
      setStyleSetError(null);
      try {
        const provider = getImageProvider(model);
        const finalPrompt = await buildImagePrompt({
          userPrompt: prompt,
          purpose: "spanning-background",
          spanPanelCount: panelCount,
        });
        const result = await provider.generate({
          prompt: finalPrompt,
          resolution,
        });
        const slices = await sliceImageVertically(result.dataUrl, panelCount);
        setScreenshotsState((prev) =>
          prev.map((s, i) => ({
            ...s,
            backgroundMode: "image",
            backgroundImageSrc: slices[i] ?? s.backgroundImageSrc,
          })),
        );
        return true;
      } catch (err) {
        setStyleSetError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setIsStyleingSet(false);
      }
    },
    [activeProject.ai, brandFolderContents, screenshots],
  );

  const applyAccentOverlaysAcrossSet = useCallback(
    async ({
      promptHint,
      model,
      resolution,
    }: {
      promptHint?: string;
      model: ImageModelId;
      resolution: ImageResolution;
    }) => {
      const panels = screenshots;
      if (panels.length === 0) return false;
      setIsStyleingSet(true);
      setStyleSetError(null);
      try {
        const provider = getImageProvider(model);
        // Generate one accent per panel sequentially. Could be parallelized,
        // but each subprocess call is heavy and parallelism risks API rate
        // limits on the underlying image API.
        const generated: { panelId: string; dataUrl: string }[] = [];
        for (const panel of panels) {
          const subject =
            panel.headline?.trim() || panel.subheadline?.trim() || "app feature";
          const subjectPhrase = [
            `A small isolated illustration reinforcing "${subject}".`,
            promptHint?.trim() ? `Style note from user: ${promptHint.trim()}.` : null,
          ]
            .filter(Boolean)
            .join(" ");
          const finalPrompt = await buildImagePrompt({
            userPrompt: subjectPhrase,
            purpose: "overlay-accent",
          });
          const result = await provider.generate({
            prompt: finalPrompt,
            resolution,
          });
          generated.push({ panelId: panel.id, dataUrl: result.dataUrl });
        }
        const aspectByPanel = new Map<string, number>();
        await Promise.all(
          generated.map(
            (g) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  aspectByPanel.set(
                    g.panelId,
                    img.width / Math.max(1, img.height),
                  );
                  resolve();
                };
                img.onerror = () => {
                  aspectByPanel.set(g.panelId, 1);
                  resolve();
                };
                img.src = g.dataUrl;
              }),
          ),
        );
        setScreenshotsState((prev) =>
          prev.map((s) => {
            const accent = generated.find((g) => g.panelId === s.id);
            if (!accent) return s;
            const aspect = aspectByPanel.get(s.id) ?? 1;
            const overlay: ImageOverlay = {
              id: generateId(),
              src: accent.dataUrl,
              x: 50,
              y: 78,
              width: 22,
              height: 22 / aspect,
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
            return {
              ...s,
              overlayImages: [...s.overlayImages, overlay],
            };
          }),
        );
        return true;
      } catch (err) {
        setStyleSetError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setIsStyleingSet(false);
      }
    },
    [activeProject.ai, brandFolderContents, screenshots],
  );

  const applySpanningOverlayAcrossSet = useCallback(
    async ({
      prompt,
      model,
      resolution,
      startPanelIndex,
      endPanelIndex,
      bandHeightPercent,
      verticalAnchor,
      layer,
    }: {
      prompt: string;
      model: ImageModelId;
      resolution: ImageResolution;
      startPanelIndex: number;
      endPanelIndex: number;
      bandHeightPercent: number;
      verticalAnchor: "top" | "middle" | "bottom";
      layer: "behind" | "front";
    }) => {
      if (!prompt.trim()) {
        setStyleSetError("Prompt is required for a spanning overlay.");
        return false;
      }
      const total = screenshots.length;
      if (total === 0) return false;
      const start = Math.max(0, Math.min(total - 1, startPanelIndex));
      const end = Math.max(start, Math.min(total - 1, endPanelIndex));
      const count = end - start + 1;
      const heightPercent = Math.max(5, Math.min(100, bandHeightPercent));
      setIsStyleingSet(true);
      setStyleSetError(null);
      try {
        const provider = getImageProvider(model);
        const subjectPhrase = [
          prompt.trim(),
          `Focus the important content vertically near the ${verticalAnchor === "top" ? "top" : verticalAnchor === "bottom" ? "bottom" : "center"} of the image.`,
        ].join(" ");
        const finalPrompt = await buildImagePrompt({
          userPrompt: subjectPhrase,
          purpose: "spanning-overlay",
          spanPanelCount: count,
        });
        const result = await provider.generate({
          prompt: finalPrompt,
          resolution,
        });
        // Compute the slice aspect that would render at width=100% and
        // height=bandHeightPercent% on the panel. That tells us how tall a
        // horizontal band to crop from the source.
        const activeExportSize =
          exportSizes.find((s) => s.id === exportSizeId) ?? exportSizes[0];
        const panelAspect =
          activeExportSize.width / activeExportSize.height;
        const bandFraction = heightPercent / 100;
        const targetSliceAspect = panelAspect / bandFraction;
        const slices = await sliceImageBand(
          result.dataUrl,
          count,
          targetSliceAspect,
          verticalAnchor,
        );
        const yCenter =
          verticalAnchor === "top"
            ? heightPercent / 2
            : verticalAnchor === "bottom"
              ? 100 - heightPercent / 2
              : 50;
        setScreenshotsState((prev) =>
          prev.map((s, i) => {
            if (i < start || i > end) return s;
            const sliceIndex = i - start;
            const sliceUrl = slices[sliceIndex];
            if (!sliceUrl) return s;
            const overlay: ImageOverlay = {
              id: generateId(),
              src: sliceUrl,
              x: 50,
              y: yCenter,
              width: 100,
              height: heightPercent,
              layer,
              rotation: 0,
              shadow: {
                enabled: false,
                color: "#000000",
                blur: 20,
                offsetX: 0,
                offsetY: 10,
              },
            };
            return {
              ...s,
              overlayImages: [...s.overlayImages, overlay],
            };
          }),
        );
        return true;
      } catch (err) {
        setStyleSetError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setIsStyleingSet(false);
      }
    },
    [
      activeProject.ai,
      brandFolderContents,
      exportSizeId,
      screenshots,
    ],
  );

  const clearStyleSetError = useCallback(() => {
    setStyleSetError(null);
  }, []);

  const suggestImagePrompts = useCallback(
    async (kind: ImagePromptKind) => {
      setIsSuggestingImagePrompts(true);
      setImagePromptSuggestionsError(null);
      setImagePromptSuggestions([]);
      try {
        const providerId = activeProject.ai?.provider ?? "claude";
        const provider = getProvider(providerId);
        // For spanning prompts, give the AI the existing headlines so the
        // suggestions tie back to the actual listing story.
        const liveScreenshots = screenshots;
        const context =
          kind === "spanning-background" && liveScreenshots.length > 0
            ? `${liveScreenshots.length} panels in this listing, in order:\n${liveScreenshots
                .map((s, i) => `  ${i + 1}. ${s.headline}`)
                .join("\n")}`
            : undefined;
        const result = await generateImagePrompts({
          provider,
          model: resolveModelForTier(providerId, "cheap"),
          kind,
          brand: {
            brandName: activeProject.ai?.brandName,
            audience: activeProject.ai?.audience,
            voice: activeProject.ai?.voice,
            keyFeature: activeProject.ai?.keyFeature,
            folder: brandFolderContents,
          },
          context,
        });
        if (result.prompts.length === 0) {
          setImagePromptSuggestionsError(
            `Couldn't parse prompt suggestions. Raw:\n${result.raw.slice(0, 200)}`,
          );
          return;
        }
        setImagePromptSuggestions(result.prompts);
      } catch (err) {
        setImagePromptSuggestionsError(
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setIsSuggestingImagePrompts(false);
      }
    },
    [activeProject.ai, brandFolderContents, screenshots],
  );

  const clearImagePromptSuggestions = useCallback(() => {
    setImagePromptSuggestions([]);
    setImagePromptSuggestionsError(null);
  }, []);

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

  // --- Undo history ------------------------------------------------------
  // Snapshots the four pieces of editor state that the user can directly
  // mutate. Per-project so switching projects doesn't mix histories. Captures
  // debounced so a burst of changes (drag, typing) collapses into one undo.
  type HistorySnapshot = {
    screenshots: Screenshot[];
    headlineFontSize: number;
    subheadlineFontSize: number;
    activeScreenshotId: string;
  };
  const HISTORY_LIMIT = 50;
  const CAPTURE_DEBOUNCE_MS = 400;

  const historyRef = useRef<Map<string, HistorySnapshot[]>>(new Map());
  const lastCommittedRef = useRef<{
    projectId: string;
    snapshot: HistorySnapshot;
  } | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const isUndoingRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);

  const refreshCanUndo = useCallback(() => {
    const stack = historyRef.current.get(activeProjectId);
    setCanUndo((stack?.length ?? 0) > 0);
  }, [activeProjectId]);

  const snapshotsEqual = (a: HistorySnapshot, b: HistorySnapshot) =>
    a.screenshots === b.screenshots &&
    a.headlineFontSize === b.headlineFontSize &&
    a.subheadlineFontSize === b.subheadlineFontSize &&
    a.activeScreenshotId === b.activeScreenshotId;

  const commitPendingCapture = useCallback(() => {
    if (captureTimerRef.current !== null) {
      window.clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    const previous = lastCommittedRef.current;
    if (!previous || previous.projectId !== activeProjectId) return;
    const current: HistorySnapshot = {
      screenshots,
      headlineFontSize,
      subheadlineFontSize,
      activeScreenshotId,
    };
    if (snapshotsEqual(previous.snapshot, current)) return;
    const stack = historyRef.current.get(activeProjectId) ?? [];
    stack.push(previous.snapshot);
    if (stack.length > HISTORY_LIMIT) stack.shift();
    historyRef.current.set(activeProjectId, stack);
    lastCommittedRef.current = { projectId: activeProjectId, snapshot: current };
    refreshCanUndo();
  }, [
    activeProjectId,
    screenshots,
    headlineFontSize,
    subheadlineFontSize,
    activeScreenshotId,
    refreshCanUndo,
  ]);

  // Watch editor state and queue history captures. Skip during drag (we want
  // one history step per drag, not one per pixel) and during undo itself.
  useEffect(() => {
    if (!isHydrated) return;
    const current: HistorySnapshot = {
      screenshots,
      headlineFontSize,
      subheadlineFontSize,
      activeScreenshotId,
    };
    // First commit for this project — seed the baseline without pushing
    // anything onto the stack.
    if (
      !lastCommittedRef.current ||
      lastCommittedRef.current.projectId !== activeProjectId
    ) {
      lastCommittedRef.current = { projectId: activeProjectId, snapshot: current };
      refreshCanUndo();
      return;
    }
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      lastCommittedRef.current = { projectId: activeProjectId, snapshot: current };
      return;
    }
    if (isDragging) return;
    if (captureTimerRef.current !== null) {
      window.clearTimeout(captureTimerRef.current);
    }
    captureTimerRef.current = window.setTimeout(() => {
      captureTimerRef.current = null;
      commitPendingCapture();
    }, CAPTURE_DEBOUNCE_MS);
  }, [
    isHydrated,
    isDragging,
    activeProjectId,
    screenshots,
    headlineFontSize,
    subheadlineFontSize,
    activeScreenshotId,
    commitPendingCapture,
    refreshCanUndo,
  ]);

  const undo = useCallback(() => {
    if (isDragging) return;
    commitPendingCapture();
    const stack = historyRef.current.get(activeProjectId);
    if (!stack || stack.length === 0) return;
    const previous = stack.pop()!;
    historyRef.current.set(activeProjectId, stack);
    isUndoingRef.current = true;
    setScreenshotsState(previous.screenshots);
    setHeadlineFontSizeState(previous.headlineFontSize);
    setSubheadlineFontSizeState(previous.subheadlineFontSize);
    setActiveScreenshotIdState(previous.activeScreenshotId);
    setSelectedElement(null);
    refreshCanUndo();
  }, [activeProjectId, commitPendingCapture, isDragging, refreshCanUndo]);

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

  /**
   * Clone a project as a sibling variant targeting a different platform.
   * Both projects end up sharing a `groupId` / `groupName` so the picker can
   * group them. The new variant gets:
   *   - swapped device + color (first color of target platform's flagship)
   *   - swapped exportSizeId to match target's app-store requirement
   *   - cleared device screen images (iPhone captures don't fit Android frames)
   *   - copied text, backgrounds, layouts, overlay images
   */
  const duplicateProjectAsPlatform = (
    sourceId: string,
    platform: PlatformKey,
  ) => {
    const source = projects.find((p) => p.id === sourceId);
    if (!source) return;
    const target = getPlatform(platform);
    const targetDevice = getDeviceSpecById(target.deviceId);
    const targetColorId = targetDevice.colors[0].id;

    // Promote standalone source into a group on first duplication, so both
    // projects render under the same parent in the picker.
    const groupId = source.groupId ?? generateId();
    const groupName =
      source.groupName ??
      source.name.replace(/\s+—\s+.+$/, "").trim() ??
      source.name;

    const sourcePlatform =
      source.platform ?? inferPlatformFromDevice(source.selectedDeviceId);

    const clonedScreenshots = source.screenshots.map((screenshot) => {
      const clonedDevices = screenshot.devices.map((d) => ({
        ...d,
        id: generateId(),
        deviceId: target.deviceId,
        colorId: targetColorId,
        screenshotSrc: null,
      }));
      return {
        ...screenshot,
        id: generateId(),
        devices: clonedDevices,
        activeDeviceId: clonedDevices[0].id,
        overlayImages: screenshot.overlayImages.map((img) => ({
          ...img,
          id: generateId(),
        })),
      };
    });

    const newProject: Project = {
      ...source,
      id: generateId(),
      name: `${groupName} — ${target.label}`,
      groupId,
      groupName,
      platform,
      selectedDeviceId: target.deviceId,
      selectedColorId: targetColorId,
      exportSizeId: target.exportSizeId,
      screenshots: clonedScreenshots,
      activeScreenshotId: clonedScreenshots[0].id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setProjects((prev) => {
      const tagged = prev.map((p) =>
        p.id === sourceId
          ? {
              ...p,
              groupId,
              groupName,
              platform: p.platform ?? sourcePlatform,
            }
          : p,
      );
      return [...tagged, newProject];
    });
    applyProjectToState(newProject);
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

    // Drop the deleted project's undo history so the Map doesn't grow
    // forever as projects come and go.
    historyRef.current.delete(id);

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

      const rawX = dragStartElementPos.current.x + deltaX;
      const rawY = dragStartElementPos.current.y + deltaY;

      // Holding Alt suppresses snap so the user can place freely.
      const skipSnap = e.altKey;
      const activeIndex = screenshots.findIndex(
        (s) => s.id === selectedElement.screenshotId,
      );

      let newX = rawX;
      let newY = rawY;
      let nextGuides: DragGuides = {};
      if (!skipSnap && activeIndex >= 0) {
        const snap = computeSnap(
          screenshots,
          activeIndex,
          selectedElement,
          rawX,
          rawY,
        );
        newX = snap.x;
        newY = snap.y;
        nextGuides = snap.guides;
      }

      setDragGuides(nextGuides);
      pendingUpdate.current = { x: newX, y: newY };

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(applyDragUpdate);
      }
    },
    [isDragging, selectedElement, applyDragUpdate, screenshots],
  );

  const handleElementMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragGuides({});
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
        // Hero panels have no devices; ignore the upload silently.
        if (!activeDevice) return;
        const targetScreenshotId = activeScreenshot.id;
        // Replace the device image AND clear the cached screen description.
        // Without the clear, a stale description from a previous image on this
        // panel (or one inherited via clone) would short-circuit vision and
        // every AI feature would describe the WRONG screen.
        updateActiveScreenshot({
          devices: activeScreenshot.devices.map((device) =>
            device.id === activeDevice.id
              ? { ...device, screenshotSrc: result }
              : device,
          ),
          screenDescription: undefined,
        });
        // Fire vision with the KNOWN new image URL — don't go through
        // ensure*ForActive*, which would read stale `screenshots` state from
        // closure (the React state update above is async) and re-describe the
        // OLD image instead.
        void extractAndCacheScreenDescription(targetScreenshotId, result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const getBackgroundStyle = (screenshot: Screenshot) => {
    if (screenshot.backgroundMode === "image" && screenshot.backgroundImageSrc) {
      // Layered background:
      //   1. Optional overlay (when opacity < 1): semi-transparent
      //      backgroundColor that tints the image toward the bg color so
      //      the user can fade the image without changing its content.
      //   2. The image itself, cover-sized + centered.
      //   3. Solid backgroundColor at the bottom as fallback while the
      //      dataURL is decoding and the bottom layer for the overlay.
      // url() must be quoted because dataURLs contain commas + semicolons
      // that confuse the CSS shorthand parser.
      const opacity = screenshot.backgroundImageOpacity ?? 1;
      const overlayAlpha = Math.max(0, Math.min(1, 1 - opacity));
      if (overlayAlpha === 0) {
        return `url("${screenshot.backgroundImageSrc}") center / cover no-repeat, ${screenshot.backgroundColor}`;
      }
      const { r, g, b } = hexToRgb(screenshot.backgroundColor);
      const overlay = `linear-gradient(rgba(${r},${g},${b},${overlayAlpha}), rgba(${r},${g},${b},${overlayAlpha}))`;
      return `${overlay}, url("${screenshot.backgroundImageSrc}") center / cover no-repeat, ${screenshot.backgroundColor}`;
    }
    if (screenshot.backgroundMode === "gradient") {
      if (screenshot.customGradient) {
        return `linear-gradient(180deg, ${screenshot.customGradient.from}, ${screenshot.customGradient.to})`;
      }
      const preset =
        gradientPresets.find((p) => p.id === screenshot.gradientPresetId) ??
        gradientPresets[0];
      return `linear-gradient(180deg, ${preset.from}, ${preset.to})`;
    }
    return screenshot.backgroundColor;
  };

  const handleExport = async () => {
    try {
      await exportScreenshots({
        screenshots,
        exportSize,
        previewDimensions,
        headlineFontSize,
        subheadlineFontSize,
      });
      const message =
        screenshots.length === 1
          ? "Saved appstore-screenshot-1.png to Downloads"
          : `Saved appstore-screenshots.zip (${screenshots.length} files) to Downloads`;
      setExportToast({ message, tone: "success" });
    } catch (err) {
      console.error("Export failed:", err);
      setExportToast({
        message: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        tone: "error",
      });
    }
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
    setExportToast(null);
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
        duplicateProjectAsPlatform,

        isFontPickerOpen,
        setIsFontPickerOpen,
        exportToast,
        dismissExportToast,
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
        dragGuides,
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
        // Undo
        undo,
        canUndo,
        // AI / brand
        aiConfig,
        updateAIConfig,
        brandFolderContents,
        isLoadingBrandFolder,
        brandFolderError,
        pickAndLoadBrandFolder,
        clearBrandFolder,
        isGeneratingContent,
        contentSuggestions,
        contentError,
        generateContentSuggestions,
        applyContentSuggestion,
        dismissContentSuggestions,
        isGeneratingTheme,
        themeSuggestion,
        themeError,
        generateThemeSuggestion,
        applyThemeSuggestion,
        dismissThemeSuggestion,
        isGeneratingLayout,
        layoutSuggestion,
        layoutError,
        generateLayoutSuggestion,
        applyLayoutSuggestion,
        dismissLayoutSuggestion,
        isExtractingScreenDescription,
        refreshScreenDescription,
        isGeneratingFullScreenshot,
        generateFullScreenshotError,
        generateFullScreenshotFromIdea,
        clearGenerateFullScreenshotError,
        isGeneratingListing,
        generateListingError,
        generateListingFromIdea,
        clearGenerateListingError,
        isGeneratingHero,
        generateHeroError,
        generateHero,
        clearGenerateHeroError,
        isGeneratingAIImage,
        generateAIImageError,
        generateAIImage,
        clearGenerateAIImageError,
        clearBackgroundImage,
        isStyleingSet,
        styleSetError,
        applyCoherentThemeAcrossSet,
        applySpanningImageAcrossSet,
        applyAccentOverlaysAcrossSet,
        applySpanningOverlayAcrossSet,
        clearStyleSetError,
        isSuggestingImagePrompts,
        imagePromptSuggestions,
        imagePromptSuggestionsError,
        suggestImagePrompts,
        clearImagePromptSuggestions,
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
