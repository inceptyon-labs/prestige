/**
 * Global settings context.
 *
 * Provides the loaded AppSettings + an `updateSettings` mutator that
 * persists to disk. Mounted near the root so any component (modals,
 * AI provider modules invoked from EditorContext) can read settings.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "./types";
import { loadSettings, saveSettings } from "./storage";

interface SettingsContextValue {
  settings: AppSettings;
  isHydrated: boolean;
  updateSettings: (
    next: AppSettings | ((prev: AppSettings) => AppSettings),
  ) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);
  // Mirror of latest settings — lets non-React code (AI providers spawned
  // inside callbacks) read fresh values via getCurrentSettings().
  const latestRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSettings();
      if (cancelled) return;
      latestRef.current = loaded;
      setSettings(loaded);
      setIsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the ref + disk in sync whenever settings change. We don't save
  // until hydration finishes so we don't write defaults over the user's
  // file during the first frame.
  useEffect(() => {
    latestRef.current = settings;
    currentSettingsRef = settings;
    if (!isHydrated) return;
    void saveSettings(settings).catch((err) =>
      console.error("[settings] save failed:", err),
    );
  }, [settings, isHydrated]);

  const updateSettings = (
    next: AppSettings | ((prev: AppSettings) => AppSettings),
  ) => {
    setSettings((prev) =>
      typeof next === "function"
        ? (next as (p: AppSettings) => AppSettings)(prev)
        : next,
    );
  };

  return (
    <SettingsContext.Provider value={{ settings, isHydrated, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};

/**
 * Module-level mirror of current settings. Lets AI provider modules
 * (which run inside async callbacks, not React render) get up-to-date
 * settings without prop-drilling.
 */
let currentSettingsRef: AppSettings = DEFAULT_SETTINGS;
export const getCurrentSettings = (): AppSettings => currentSettingsRef;
