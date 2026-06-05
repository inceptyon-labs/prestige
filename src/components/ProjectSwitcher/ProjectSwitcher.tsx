/**
 * ProjectSwitcher Component
 *
 * Dropdown component for managing projects. Allows users to:
 * - View all projects, with platform-variant siblings grouped under their app
 * - Switch between projects
 * - Create new projects
 * - Rename existing projects
 * - Delete projects
 * - Duplicate a project as a new platform variant (iPhone → iPad/Mac/Android/etc.)
 * - Duplicate a project as a localized variant (English → Spanish/French/etc.),
 *   AI-translating its copy
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
  Layers,
  Languages,
  Loader2,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import { PLATFORMS, LOCALES, getLocale } from "../../constants";
import type { PlatformKey, Project } from "../../types";

type ProjectRowProps = {
  project: Project;
  isActive: boolean;
  isVariant: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => Promise<void>;
  onDuplicateAsPlatform: (platform: PlatformKey) => void;
  onDuplicateAsLocale: (localeKey: string) => void;
  isLocalizing: boolean;
  canDelete: boolean;
};

const ProjectRow = ({
  project,
  isActive,
  isVariant,
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
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false);
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [localeMenuPos, setLocaleMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const platformMenuRef = useRef<HTMLDivElement>(null);
  const platformBtnRef = useRef<HTMLButtonElement>(null);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  const localeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isPlatformMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        platformMenuRef.current?.contains(target) ||
        platformBtnRef.current?.contains(target)
      ) {
        return;
      }
      setIsPlatformMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isPlatformMenuOpen]);

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

  // Anchor the portal-rendered menu to the trigger button's screen position.
  // Re-measure on open so it tracks the button if the row scrolls.
  useLayoutEffect(() => {
    if (!isPlatformMenuOpen || !platformBtnRef.current) return;
    const rect = platformBtnRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
  }, [isPlatformMenuOpen]);

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

  // Variant rows show only the platform (and locale) label, since the group
  // name above already states the app name. Standalone or first-of-group rows
  // show the full project name.
  const localeLabel = project.locale
    ? getLocale(project.locale)?.label
    : null;
  const displayLabel = isVariant
    ? [
        PLATFORMS.find((p) => p.key === project.platform)?.label,
        localeLabel,
      ]
        .filter(Boolean)
        .join(" — ") || project.name
    : project.name;

  if (isEditing) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 ${isVariant ? "pl-9" : ""}`}
      >
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

  // Platforms already taken by siblings shouldn't be re-offered. We don't have
  // sibling info here, so we just disable the project's *own* platform.
  const availablePlatforms = PLATFORMS.filter(
    (p) => p.key !== project.platform,
  );

  // Languages: offer every preset locale except this project's own.
  const availableLocales = LOCALES.filter((l) => l.key !== project.locale);

  return (
    <div
      className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
        isVariant ? "pl-9" : ""
      } ${
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
        <button
          ref={platformBtnRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsPlatformMenuOpen((v) => !v);
          }}
          className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
          title="Duplicate as platform variant"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
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
      {isPlatformMenuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={platformMenuRef}
            data-platform-menu
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[120] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              Duplicate as
            </div>
            {availablePlatforms.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  onDuplicateAsPlatform(p.key);
                  setIsPlatformMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
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

type ProjectGroup = {
  groupKey: string;
  groupName: string | null; // null for standalone single-project entries
  projects: Project[];
};

const groupProjects = (projects: Project[]): ProjectGroup[] => {
  const groups = new Map<string, ProjectGroup>();
  const order: string[] = [];
  for (const p of projects) {
    if (p.groupId) {
      if (!groups.has(p.groupId)) {
        groups.set(p.groupId, {
          groupKey: p.groupId,
          groupName: p.groupName ?? p.name,
          projects: [],
        });
        order.push(p.groupId);
      }
      groups.get(p.groupId)!.projects.push(p);
    } else {
      const key = `solo-${p.id}`;
      groups.set(key, {
        groupKey: key,
        groupName: null,
        projects: [p],
      });
      order.push(key);
    }
  }
  return order.map((k) => groups.get(k)!);
};

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

  // Auto-expand the group containing the active project; remember collapse
  // state for the rest within the session.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(grouped.map((g) => g.groupKey)),
  );

  useEffect(() => {
    const activeGroup = grouped.find((g) =>
      g.projects.some((p) => p.id === activeProjectId),
    );
    if (activeGroup && !expandedGroups.has(activeGroup.groupKey)) {
      setExpandedGroups((prev) => new Set(prev).add(activeGroup.groupKey));
    }
  }, [activeProjectId, grouped, expandedGroups]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!dropdownRef.current || dropdownRef.current.contains(target as Node)) {
        return;
      }
      // The "Duplicate as platform" and "Duplicate as language" menus are
      // rendered through portals at body level, so they're outside `dropdownRef`.
      // Keep the dropdown open when a click lands inside one of those portal
      // menus — otherwise React unmounts the menu between mousedown and click
      // and the menu item's click handler never fires.
      if (target?.closest("[data-platform-menu]") || target?.closest("[data-locale-menu]")) {
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
            {grouped.map((group) => {
              const isStandalone = group.groupName === null;
              if (isStandalone) {
                const p = group.projects[0];
                return (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    isActive={p.id === activeProjectId}
                    isVariant={false}
                    onSelect={() => {
                      switchProject(p.id);
                      setIsOpen(false);
                    }}
                    onRename={(name) => renameProject(p.id, name)}
                    onDelete={async () => await deleteProject(p.id)}
                    onDuplicateAsPlatform={(platform) => {
                      duplicateProjectAsPlatform(p.id, platform);
                      setIsOpen(false);
                    }}
                    onDuplicateAsLocale={(localeKey) => {
                      void duplicateProjectAsLocale(p.id, localeKey);
                      setIsOpen(false);
                    }}
                    isLocalizing={localizingProjectId === p.id}
                    canDelete={projects.length > 1}
                  />
                );
              }

              const isExpanded = expandedGroups.has(group.groupKey);
              return (
                <div key={group.groupKey}>
                  <button
                    onClick={() => toggleGroup(group.groupKey)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    )}
                    <FolderOpen className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium flex-1 text-left truncate">
                      {group.groupName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {group.projects.length} variant
                      {group.projects.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {isExpanded &&
                    group.projects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        isActive={p.id === activeProjectId}
                        isVariant={true}
                        onSelect={() => {
                          switchProject(p.id);
                          setIsOpen(false);
                        }}
                        onRename={(name) => renameProject(p.id, name)}
                        onDelete={async () => await deleteProject(p.id)}
                        onDuplicateAsPlatform={(platform) => {
                          duplicateProjectAsPlatform(p.id, platform);
                          setIsOpen(false);
                        }}
                        onDuplicateAsLocale={(localeKey) => {
                          void duplicateProjectAsLocale(p.id, localeKey);
                          setIsOpen(false);
                        }}
                        isLocalizing={localizingProjectId === p.id}
                        canDelete={projects.length > 1}
                      />
                    ))}
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
