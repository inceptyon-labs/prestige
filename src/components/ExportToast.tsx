import { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

interface ExportToastProps {
  toast: { message: string; tone: "success" | "error" } | null;
  onDismiss: () => void;
}

export const ExportToast = ({ toast, onDismiss }: ExportToastProps) => {
  useEffect(() => {
    if (!toast || toast.tone !== "success") return;
    const id = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isError = toast.tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-md ${
          isError
            ? "border-red-500/40 bg-red-950/80 text-red-50"
            : "border-emerald-500/40 bg-emerald-950/80 text-emerald-50"
        }`}
      >
        <Icon
          size={18}
          className={isError ? "text-red-300" : "text-emerald-300"}
        />
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-2 rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
