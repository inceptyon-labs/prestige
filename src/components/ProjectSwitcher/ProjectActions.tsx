/**
 * ProjectActions
 *
 * Compact action row directly below the project switcher offering:
 *   - Save snapshot (named, frozen version of the current project)
 *   - Restore / delete existing snapshots
 *   - Export current project to .appshots.json
 *   - Import a .appshots.json file
 *
 * Snapshots live in IndexedDB alongside projects and survive reloads / browser
 * restarts on the same machine. Exports give the user a portable backup that
 * isn't trapped in browser storage.
 */

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Download,
  History,
  Upload,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";

const formatTimestamp = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const ProjectActions = () => {
  const {
    snapshots,
    refreshSnapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    exportProjectToFile,
    importProjectFromFile,
  } = useEditor();

  const [isSnapOpen, setIsSnapOpen] = useState(false);
  const [snapName, setSnapName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSnapOpen) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsSnapOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isSnapOpen]);

  const handleCreateSnapshot = async () => {
    const name = snapName.trim() || `Snapshot ${new Date().toLocaleString()}`;
    await createSnapshot(name);
    setSnapName("");
  };

  const handleImportClick = () => {
    setImportError(null);
    importInputRef.current?.click();
  };

  const handleImportChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importProjectFromFile(file);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mt-2 flex items-center gap-1 text-zinc-400">
      <button
        type="button"
        onClick={() => {
          void refreshSnapshots();
          setIsSnapOpen((v) => !v);
        }}
        title="Snapshots"
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <History className="w-3.5 h-3.5" />
        Snapshots
        {snapshots.length > 0 && (
          <span className="text-[10px] text-zinc-500">({snapshots.length})</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => exportProjectToFile()}
        title="Export project as JSON"
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
      <button
        type="button"
        onClick={handleImportClick}
        title="Import project JSON"
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        Import
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportChange}
      />
      {importError && (
        <span className="text-[10px] text-red-400 truncate" title={importError}>
          {importError}
        </span>
      )}

      {isSnapOpen && (
        <div
          ref={panelRef}
          className="absolute left-4 right-4 top-full mt-2 z-40 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Snapshots
            </span>
            <button
              type="button"
              onClick={() => setIsSnapOpen(false)}
              className="p-1 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 flex items-center gap-2 border-b border-zinc-800">
            <input
              type="text"
              value={snapName}
              onChange={(e) => setSnapName(e.target.value)}
              placeholder="Snapshot name (optional)"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateSnapshot();
              }}
              className="flex-1 px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => void handleCreateSnapshot()}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 rounded text-white transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              Save
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {snapshots.length === 0 && (
              <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                No snapshots yet. Save one before risky edits.
              </div>
            )}
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="group flex items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-800/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{snap.name}</div>
                  <div className="text-[11px] text-zinc-500">
                    {formatTimestamp(snap.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void restoreSnapshot(snap.id)}
                  title="Restore"
                  className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSnapshot(snap.id)}
                  title="Delete"
                  className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectActions;
