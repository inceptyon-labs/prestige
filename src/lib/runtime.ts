/**
 * Runtime detection.
 *
 * Prestige ships in two flavours from the same React code: a web build
 * (browser, IndexedDB persistence) and a Tauri desktop build (native window,
 * filesystem persistence). Anything that needs to branch — storage adapter,
 * file dialogs, AI subprocess access — should use these helpers instead of
 * sniffing globals inline so the check is easy to grep for.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

/** True when running inside the Tauri WebView. */
export const isTauri = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    typeof window.__TAURI_INTERNALS__ !== "undefined" ||
    typeof window.__TAURI__ !== "undefined"
  );
};

/** True when running in a plain browser (web demo). */
export const isWeb = (): boolean => !isTauri();
