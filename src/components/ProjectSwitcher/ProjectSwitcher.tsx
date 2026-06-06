/**
 * ProjectSwitcher Component
 *
 * Dropdown component for managing projects. Allows users to:
 * - View all projects as an App → Platform → Language tree
 * - Switch between projects
 * - Create new projects
 * - Rename existing projects
 * - Delete projects
 * - Duplicate a project as a new platform variant (iPhone → iPad/Mac/Android/etc.)
 * - Duplicate a project as a localized variant (English → Spanish/French/etc.),
 *   AI-translating its copy
 *
 * Variants of one app (shared `groupId`) are grouped by platform; platforms
 * with multiple languages nest those languages under a collapsible subgroup,
 * while single-language platforms render as a flat row.
 */

import { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  FolderOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  X,
  Languages,
  Loader2,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import { PLATFORMS, LOCALES, getLocale, getPlatform } from "../../constants";
import { PlatformMenuButton } from "../AISuggest";
import type { PlatformKey, Project } from "../../types";

type ProjectRowProps = {
  project: Project;
  isActive: boolean;
  /** Indentation level: 0 standalone, 1 platform row, 2 language leaf. */
  depth?: 0 | 1 | 2;
  /** Explicit display label; falls back to the project's own name. */
  label?: string;
  /** Show the "duplicate as platform" action (hidden on language leaves). */
  showDuplicatePlatform?: boolean;
  /** Platforms already present in this app group (omitted from the menu). */
  excludePlatforms?: readonly PlatformKey[];
  /** Locales already present for this platform (omitted from the menu). */
  excludeLocales?: readonly string[];
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => Promise<void>;
  onDuplicateAsPlatform: (platform: PlatformKey) => void;
  onDuplicateAsLocale: (localeKey: string) => void;
  isLocalizing: boolean;
  canDelete: boolean;
};

const DEPTH_PADDING: Record<0 | 1 | 2, string> = {
  0: "",
  1: "pl-9",
  2: "pl-14",
};

const ProjectRow = ({
  project,
  isActive,
  depth = 0,
  label,
  showDuplicatePlatform = true,
  excludePlatforms,
  excludeLocales,
  onSelect,
  onRename,
  onDelete,
  onDuplicateAsPlatform,
  onDuplicateAsLocale,
  isLocalizing,
  canDelete,
}: ProjectRowProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false);
  const [localeMenuPos, setLocaleMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  const localeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isLocaleMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        localeMenuRef.current?.contains(target) ||
        localeBtnRef.current?.contains(target)
      ) {
        return;
      }
      setIsLocaleMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isLocaleMenuOpen]);

  useLayoutEffect(() => {
    if (!isLocaleMenuOpen || !localeBtnRef.current) return;
    const rect = localeBtnRef.current.getBoundingClientRect();
    setLocaleMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
  }, [isLocaleMenuOpen]);

  const handleSave = () => {
    if (editName.trim()) onRename(editName.trim());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    else if (e.key === "Escape") {
      setEditName(project.name);
      setIsEditing(false);
    }
  };

  const displayLabel = label ?? project.name;
  const indent = DEPTH_PADDING[depth];

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${indent}`}>
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-1 px-2 py-1 text-sm bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-violet-500"
        />
        <button
          onClick={handleSave}
          className="p-1 hover:bg-zinc-700 rounded text-green-400"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setEditName(project.name);
            setIsEditing(false);
          }}
          className="p-1 hover:bg-zinc-700 rounded text-red-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Exclude the project's own locale plus any locales already present for this
  // platform in the group (passed down as `excludeLocales`).
  const takenLocales = new Set<string | undefined>([
    project.locale,
    ...(excludeLocales ?? []),
  ]);
  const availableLocales = LOCALES.filter((l) => !takenLocales.has(l.key));

  // Exclude the project's own platform plus any platforms already in the group.
  const takenPlatforms: PlatformKey[] = [
    ...(project.platform ? [project.platform] : []),
    ...(excludePlatforms ?? []),
  ];

  return (
    <div
      className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${indent} ${
        isActive
          ? "bg-violet-600/20 text-violet-400"
          : "hover:bg-zinc-800 text-zinc-300"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FolderOpen className="w-4 h-4 flex-shrink-0" />
        <span className="truncate text-sm">{displayLabel}</span>
        <span className="text-xs text-zinc-500">
          ({project.screenshots.length})
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {showDuplicatePlatform && (
          <PlatformMenuButton
            onSelect={onDuplicateAsPlatform}
            exclude={takenPlatforms}
          />
        )}
        <button
          ref={localeBtnRef}
          disabled={isLocalizing}
          onClick={(e) => {
            e.stopPropagation();
            if (isLocalizing) return;
            setIsLocaleMenuOpen((v) => !v);
          }}
          className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-default"
          title="Duplicate as language (AI-translated)"
        >
          {isLocalizing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Languages className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
          title="Rename project"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {canDelete && (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await onDelete();
            }}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-red-400"
            title="Delete project"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isLocaleMenuOpen &&
        localeMenuPos &&
        createPortal(
          <div
            ref={localeMenuRef}
            data-locale-menu
            style={{
              position: "fixed",
              top: localeMenuPos.top,
              left: localeMenuPos.left,
            }}
            className="w-44 max-h-72 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[120]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-900">
              Translate to
            </div>
            {availableLocales.map((l) => (
              <button
                key={l.key}
                onClick={() => {
                  onDuplicateAsLocale(l.key);
                  setIsLocaleMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                {l.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

// --- Grouping: App → Platform → Language ----------------------------------

type PlatformNode = {
  /** `${groupId}:${platform}` — collapse key for this platform subgroup. */
  key: string;
  platform?: PlatformKey;
  platformLabel: string;
  /** Base (no locale) first, then localized variants in LOCALES order. */
  projects: Project[];
};

type AppNode =
  | { kind: "solo"; project: Project }
  | {
      kind: "group";
      groupKey: string;
      groupName: string;
      total: number;
      platforms: PlatformNode[];
    };

const PLATFORM_ORDER = new Map(PLATFORMS.map((p, i) => [p.key, i]));
const LOCALE_ORDER = new Map(LOCALES.map((l, i) => [l.key, i]));

const stripGroupPrefix = (p: Project) =>
  p.groupName ?? p.name.replace(/\s+—\s+.+$/, "").trim();

const buildGroupNode = (groupId: string, members: Project[]): AppNode => {
  const byPlatform = new Map<string, Project[]>();
  const platformOrder: string[] = [];
  for (const p of members) {
    const pk = p.platform ?? "none";
    if (!byPlatform.has(pk)) {
      byPlatform.set(pk, []);
      platformOrder.push(pk);
    }
    byPlatform.get(pk)!.push(p);
  }

  const platforms: PlatformNode[] = platformOrder
    .map((pk) => {
      const list = byPlatform.get(pk)!;
      list.sort((a, b) => {
        // Base (no locale) first, then by LOCALES order.
        if (!a.locale && b.locale) return -1;
        if (a.locale && !b.locale) return 1;
        return (
          (a.locale ? (LOCALE_ORDER.get(a.locale) ?? 0) : 0) -
          (b.locale ? (LOCALE_ORDER.get(b.locale) ?? 0) : 0)
        );
      });
      const platform = pk === "none" ? undefined : (pk as PlatformKey);
      const platformLabel = platform
        ? getPlatform(platform).label
        : stripGroupPrefix(list[0]);
      return { key: `${groupId}:${pk}`, platform, platformLabel, projects: list };
    })
    .sort(
      (a, b) =>
        (a.platform ? (PLATFORM_ORDER.get(a.platform) ?? 99) : 99) -
        (b.platform ? (PLATFORM_ORDER.get(b.platform) ?? 99) : 99),
    );

  return {
    kind: "group",
    groupKey: groupId,
    groupName: stripGroupPrefix(members[0]),
    total: members.length,
    platforms,
  };
};

const groupProjects = (projects: Project[]): AppNode[] => {
  // Walk once, preserving first-seen order: a solo takes its own slot; a
  // grouped app takes the slot of its first member, accumulating the rest.
  const slots: Array<{ kind: "solo"; project: Project } | { kind: "group"; groupId: string }> =
    [];
  const members = new Map<string, Project[]>();

  for (const p of projects) {
    if (p.groupId) {
      if (!members.has(p.groupId)) {
        members.set(p.groupId, []);
        slots.push({ kind: "group", groupId: p.groupId });
      }
      members.get(p.groupId)!.push(p);
    } else {
      slots.push({ kind: "solo", project: p });
    }
  }

  return slots.map((slot) =>
    slot.kind === "solo"
      ? { kind: "solo" as const, project: slot.project }
      : buildGroupNode(slot.groupId, members.get(slot.groupId)!),
  );
};

/** Label for a flat (single-language) platform row. */
const flatPlatformLabel = (node: PlatformNode): string => {
  const p = node.projects[0];
  const locale = p.locale ? getLocale(p.locale)?.label : null;
  return locale ? `${node.platformLabel} — ${locale}` : node.platformLabel;
};

/** Label for a language leaf row. */
const localeLeafLabel = (p: Project): string =>
  p.locale ? (getLocale(p.locale)?.label ?? p.locale) : "Base";

export const ProjectSwitcher = () => {
  const {
    projects,
    activeProjectId,
    activeProject,
    createProject,
    renameProject,
    deleteProject,
    switchProject,
    duplicateProjectAsPlatform,
    duplicateProjectAsLocale,
    localizingProjectId,
    localizeError,
  } = useEditor();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => groupProjects(projects), [projects]);

  // Two-level collapse state, keyed by app groupId and `${groupId}:${platform}`.
  // Default: app groups expanded, platform subgroups collapsed (the active
  // project's subgroup is force-expanded by the effect below).
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () =>
      new Set(
        grouped
          .filter((n): n is Extract<AppNode, { kind: "group" }> =>
            n.kind === "group",
          )
          .map((g) => g.groupKey),
      ),
  );

  useEffect(() => {
    const active = projects.find((p) => p.id === activeProjectId);
    if (!active?.groupId) return;
    const groupKey = active.groupId;
    const platformKey = `${active.groupId}:${active.platform ?? "none"}`;
    setExpandedGroups((prev) => {
      if (prev.has(groupKey) && prev.has(platformKey)) return prev;
      const next = new Set(prev);
      next.add(groupKey);
      next.add(platformKey);
      return next;
    });
  }, [activeProjectId, projects]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const target = e.target;
      if (!dropdownRef.current || dropdownRef.current.contains(target)) {
        return;
      }
      // The "Duplicate as platform" and "Duplicate as language" menus are
      // rendered through portals at body level, so they're outside `dropdownRef`.
      // Keep the dropdown open when a click lands inside one of those portal
      // menus — otherwise React unmounts the menu between mousedown and click
      // and the menu item's click handler never fires.
      if (
        target?.closest("[data-platform-menu]") ||
        target?.closest("[data-locale-menu]")
      ) {
        return;
      }
      setIsOpen(false);
      setIsCreating(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isCreating && newProjectInputRef.current) {
      newProjectInputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim());
      setNewProjectName("");
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreateProject();
    else if (e.key === "Escape") {
      setIsCreating(false);
      setNewProjectName("");
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canDelete = projects.length > 1;

  const rowHandlers = (p: Project) => ({
    onSelect: () => {
      switchProject(p.id);
      setIsOpen(false);
    },
    onRename: (name: string) => renameProject(p.id, name),
    onDelete: async () => await deleteProject(p.id),
    onDuplicateAsLocale: (localeKey: string) => {
      void duplicateProjectAsLocale(p.id, localeKey);
      setIsOpen(false);
    },
    isLocalizing: localizingProjectId === p.id,
    canDelete,
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-white text-sm transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <span className="truncate">{activeProject.name}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Projects
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {grouped.map((node) => {
              if (node.kind === "solo") {
                const p = node.project;
                return (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    isActive={p.id === activeProjectId}
                    depth={0}
                    onDuplicateAsPlatform={(platform) => {
                      duplicateProjectAsPlatform(p.id, platform);
                      setIsOpen(false);
                    }}
                    {...rowHandlers(p)}
                  />
                );
              }

              const groupExpanded = expandedGroups.has(node.groupKey);
              return (
                <div key={node.groupKey}>
                  <button
                    onClick={() => toggleGroup(node.groupKey)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    {groupExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    )}
                    <FolderOpen className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium flex-1 text-left truncate">
                      {node.groupName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {node.total} variant{node.total === 1 ? "" : "s"}
                    </span>
                  </button>

                  {groupExpanded &&
                    (() => {
                      // Platforms already in this app group — offered platform
                      // duplications must skip them to avoid duplicate siblings.
                      const presentPlatforms = node.platforms
                        .map((pf) => pf.platform)
                        .filter((p): p is PlatformKey => Boolean(p));
                      return node.platforms.map((pf) => {
                      // Locales already present for this platform.
                      const presentLocales = pf.projects
                        .map((p) => p.locale)
                        .filter((l): l is NonNullable<typeof l> => Boolean(l));
                      // Single-language platform → flat row (acts as both the
                      // platform and its base language; keeps all actions).
                      if (pf.projects.length === 1) {
                        const p = pf.projects[0];
                        return (
                          <ProjectRow
                            key={p.id}
                            project={p}
                            isActive={p.id === activeProjectId}
                            depth={1}
                            label={flatPlatformLabel(pf)}
                            excludePlatforms={presentPlatforms}
                            excludeLocales={presentLocales}
                            onDuplicateAsPlatform={(platform) => {
                              duplicateProjectAsPlatform(p.id, platform);
                              setIsOpen(false);
                            }}
                            {...rowHandlers(p)}
                          />
                        );
                      }

                      // Multi-language platform → collapsible subgroup.
                      const base =
                        pf.projects.find((p) => !p.locale) ?? pf.projects[0];
                      const platformExpanded = expandedGroups.has(pf.key);
                      return (
                        <div key={pf.key}>
                          <div className="group flex items-center justify-between pl-9 pr-3 py-1.5 text-zinc-300 hover:bg-zinc-800/60 transition-colors">
                            <button
                              onClick={() => toggleGroup(pf.key)}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left"
                            >
                              {platformExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                              )}
                              <span className="text-sm truncate">
                                {pf.platformLabel}
                              </span>
                              <span className="text-[11px] text-zinc-500 flex-shrink-0">
                                {pf.projects.length} langs
                              </span>
                            </button>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <PlatformMenuButton
                                onSelect={(platform) => {
                                  duplicateProjectAsPlatform(base.id, platform);
                                  setIsOpen(false);
                                }}
                                exclude={presentPlatforms}
                              />
                            </div>
                          </div>

                          {platformExpanded &&
                            pf.projects.map((p) => (
                              <ProjectRow
                                key={p.id}
                                project={p}
                                isActive={p.id === activeProjectId}
                                depth={2}
                                label={localeLeafLabel(p)}
                                showDuplicatePlatform={false}
                                excludeLocales={presentLocales}
                                onDuplicateAsPlatform={(platform) => {
                                  duplicateProjectAsPlatform(p.id, platform);
                                  setIsOpen(false);
                                }}
                                {...rowHandlers(p)}
                              />
                            ))}
                        </div>
                      );
                    });
                    })()}
                </div>
              );
            })}
          </div>

          {localizeError && (
            <div className="mx-2 mb-1 px-3 py-2 text-xs text-red-300 bg-red-950/50 border border-red-900/60 rounded">
              Translation failed: {localizeError}
            </div>
          )}

          <div className="border-t border-zinc-800">
            {isCreating ? (
              <div className="p-2 flex items-center gap-2">
                <input
                  ref={newProjectInputRef}
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Project name"
                  className="flex-1 px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-600 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="p-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-white transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewProjectName("");
                  }}
                  className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-violet-400 hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSwitcher;
