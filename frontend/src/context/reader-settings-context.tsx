"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import SettingsSheet, { type SettingsSyncStatus } from "@/components/settings-sheet";
import type { ReadingMode, TranslationLang } from "@/components/reader-toolbar";
import { DEFAULT_FONT_SIZE_INDEX } from "@/config/reader-config";
import { getApiReadiness, onReady, useApiReadiness } from "@/lib/api-readiness";
import { getUserSettings, saveUserSettings } from "@/lib/user-api";
import type { UserSettingsDto } from "@/types/user";

/**
 * Reader settings, applied instantly in memory and synced to the API for
 * signed-in users.
 *
 * Sync rules, all there to survive an API cold start (see lib/api-readiness.ts):
 *  - The initial GET is never treated as "loaded" unless it succeeds. A failed
 *    GET is retried on the next ready transition, so defaults are never PUT over
 *    the reader's saved values.
 *  - Fields the reader changes before the GET has succeeded are kept in a
 *    pending patch, overlaid on the server settings when they arrive, and then
 *    saved once.
 *  - While the API is warming or unreachable no PUT is sent; the latest value
 *    is flushed once on the next ready transition. A PUT that fails is retried
 *    the same way.
 */

export type SettingsLoadState = "idle" | "loading" | "loaded" | "failed";

export const DEFAULT_SETTINGS: UserSettingsDto = {
  mode: "verse",
  lang: "urdu",
  fontScale: DEFAULT_FONT_SIZE_INDEX,
  showTafseer: false,
};

const SAVE_DEBOUNCE_MS = 500;

/** Server settings (or defaults when the server has none) overlaid with the fields the reader changed before they arrived. */
export function mergeSettings(
  server: UserSettingsDto | null,
  patch: Partial<UserSettingsDto>,
): UserSettingsDto {
  return { ...DEFAULT_SETTINGS, ...(server ?? {}), ...patch };
}

interface ReaderSettingsContextValue {
  mode: ReadingMode;
  lang: TranslationLang;
  fontScale: number;
  showTafseer: boolean;
  updateSettings: (patch: Partial<UserSettingsDto>) => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const ReaderSettingsContext = createContext<ReaderSettingsContextValue | null>(null);

export function useReaderSettings() {
  const ctx = useContext(ReaderSettingsContext);
  if (!ctx) {
    throw new Error("useReaderSettings must be used within a ReaderSettingsProvider");
  }
  return ctx;
}

export default function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const readiness = useApiReadiness();

  const [settings, setSettings] = useState<UserSettingsDto>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadState, setLoadStateValue] = useState<SettingsLoadState>("idle");

  // Refs mirror state synchronously so callbacks and timers always read the latest values.
  const settingsRef = useRef<UserSettingsDto>(DEFAULT_SETTINGS);
  const loadStateRef = useRef<SettingsLoadState>("idle");
  const pendingPatchRef = useRef<Partial<UserSettingsDto>>({});
  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unregisterFlushRef = useRef<(() => void) | null>(null);
  const sendRef = useRef<(value: UserSettingsDto) => void>(() => {});

  const setLoadState = useCallback((next: SettingsLoadState) => {
    loadStateRef.current = next;
    setLoadStateValue(next);
  }, []);

  const applySettings = useCallback((next: UserSettingsDto) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  // Registers one flush of the latest settings for the next time the API is ready.
  const scheduleFlushOnReady = useCallback(() => {
    if (unregisterFlushRef.current) return;
    unregisterFlushRef.current = onReady(() => {
      unregisterFlushRef.current = null;
      if (dirtyRef.current) sendRef.current(settingsRef.current);
    });
  }, []);

  const send = useCallback(
    (value: UserSettingsDto) => {
      dirtyRef.current = false;
      saveUserSettings(value).catch(() => {
        dirtyRef.current = true;
        scheduleFlushOnReady();
      });
    },
    [scheduleFlushOnReady],
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Load settings from the API when authenticated; retry a failed load on ready.
  useEffect(() => {
    if (!isAuthenticated) {
      setLoadState("idle");
      pendingPatchRef.current = {};
      dirtyRef.current = false;
      unregisterFlushRef.current?.();
      unregisterFlushRef.current = null;
      return;
    }

    const controller = new AbortController();
    let unregisterRetry: (() => void) | null = null;
    let cancelled = false;

    const load = () => {
      setLoadState("loading");
      getUserSettings(controller.signal)
        .then((server) => {
          if (cancelled) return;
          const patch = pendingPatchRef.current;
          pendingPatchRef.current = {};
          const merged = mergeSettings(server, patch);
          applySettings(merged);
          setLoadState("loaded");
          if (Object.keys(patch).length > 0) send(merged);
        })
        .catch(() => {
          if (cancelled) return;
          setLoadState("failed");
          unregisterRetry = onReady(() => {
            unregisterRetry = null;
            load();
          });
        });
    };
    load();

    return () => {
      cancelled = true;
      controller.abort();
      unregisterRetry?.();
    };
  }, [isAuthenticated, applySettings, send, setLoadState]);

  // Clear timers and callbacks on unmount.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unregisterFlushRef.current?.();
    },
    [],
  );

  const persistSettings = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const current = getApiReadiness();
    if (current === "warming" || current === "unreachable") {
      dirtyRef.current = true;
      scheduleFlushOnReady();
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      send(settingsRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [scheduleFlushOnReady, send]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettingsDto>) => {
      const defined: Partial<UserSettingsDto> = {};
      if (patch.mode !== undefined) defined.mode = patch.mode;
      if (patch.lang !== undefined) defined.lang = patch.lang;
      if (patch.fontScale !== undefined) defined.fontScale = patch.fontScale;
      if (patch.showTafseer !== undefined) defined.showTafseer = patch.showTafseer;

      applySettings({ ...settingsRef.current, ...defined });

      if (!isAuthenticated) return;
      if (loadStateRef.current !== "loaded") {
        pendingPatchRef.current = { ...pendingPatchRef.current, ...defined };
        return;
      }
      persistSettings();
    },
    [isAuthenticated, applySettings, persistSettings],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  let syncStatus: SettingsSyncStatus = null;
  if (isAuthenticated && (readiness === "warming" || readiness === "unreachable")) {
    syncStatus = loadState === "loading" || loadState === "failed" ? "loading" : readiness;
  }

  const mode = settings.mode as ReadingMode;
  const lang = settings.lang as TranslationLang;
  const { fontScale, showTafseer } = settings;

  return (
    <ReaderSettingsContext.Provider
      value={{
        mode,
        lang,
        fontScale,
        showTafseer,
        updateSettings,
        settingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
      {isAuthenticated && (
        <SettingsSheet
          isOpen={settingsOpen}
          onClose={closeSettings}
          mode={mode}
          onModeChange={(m) => updateSettings({ mode: m })}
          lang={lang}
          onLangChange={(l) => updateSettings({ lang: l })}
          fontScale={fontScale}
          onFontScaleChange={(s) => updateSettings({ fontScale: s })}
          showTafseer={showTafseer}
          onTafseerChange={(t) => updateSettings({ showTafseer: t })}
          syncStatus={syncStatus}
        />
      )}
    </ReaderSettingsContext.Provider>
  );
}
