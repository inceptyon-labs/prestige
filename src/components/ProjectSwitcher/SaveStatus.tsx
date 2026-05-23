/**
 * SaveStatus
 *
 * Small inline indicator showing the live persistence status — "Saving...",
 * "Saved · 3s ago", or an error message. Backed by IndexedDB writes coming
 * from useEditorStorage; not a button.
 */

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useEditor } from "../../context/EditorContext";

const formatRelative = (then: number, now: number): string => {
  if (!then) return "not yet";
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
};

export const SaveStatus = () => {
  const { isSaving, lastSaved, saveError, saveNow } = useEditor();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  let icon = <Check className="w-3 h-3 text-emerald-400" />;
  let text = `Saved · ${formatRelative(lastSaved, now)}`;
  let tone = "text-zinc-400";

  if (saveError) {
    icon = <AlertCircle className="w-3 h-3 text-red-400" />;
    text = "Save failed";
    tone = "text-red-400";
  } else if (isSaving) {
    icon = <Loader2 className="w-3 h-3 text-zinc-300 animate-spin" />;
    text = "Saving...";
    tone = "text-zinc-300";
  } else if (!lastSaved) {
    icon = <Check className="w-3 h-3 text-zinc-500" />;
    text = "Not saved yet";
    tone = "text-zinc-500";
  }

  return (
    <button
      type="button"
      onClick={() => void saveNow()}
      title={saveError ? `Click to retry. ${saveError}` : "Click to save now"}
      className={`inline-flex items-center gap-1.5 text-[11px] ${tone} hover:text-white transition-colors`}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
};

export default SaveStatus;
