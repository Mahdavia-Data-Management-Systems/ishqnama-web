"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import SettingsSheet from "@/components/settings-sheet";
import type { ReadingMode, TranslationLang } from "@/components/reader-toolbar";
import { DEFAULT_FONT_SIZE_INDEX } from "@/config/reader-config";
import { getUserSettings, saveUserSettings } from "@/lib/user-api";
import type { UserSettingsDto } from "@/types/user";

interface ReaderSettingsContextValue {
  mode: ReadingMode;
  setMode: (mode: ReadingMode) => void;
  lang: TranslationLang;
  setLang: (lang: TranslationLang) => void;
  fontScale: number;
  setFontScale: (scale: number) => void;
  showTafseer: boolean;
  setShowTafseer: (show: boolean) => void;
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

  const [mode, setModeState] = useState<ReadingMode>("verse");
  const [lang, setLangState] = useState<TranslationLang>("urdu");
  const [fontScale, setFontScaleState] = useState(DEFAULT_FONT_SIZE_INDEX);
  const [showTafseer, setShowTafseerState] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<UserSettingsDto>({ mode, lang, fontScale, showTafseer });

  // Keep the ref in sync with the latest state
  useEffect(() => {
    settingsRef.current = { mode, lang, fontScale, showTafseer };
  }, [mode, lang, fontScale, showTafseer]);

  // Load settings from API on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    getUserSettings(controller.signal)
      .then((settings) => {
        if (settings) {
          setModeState(settings.mode as ReadingMode);
          setLangState(settings.lang as TranslationLang);
          setFontScaleState(settings.fontScale);
          setShowTafseerState(settings.showTafseer);
        }
        setLoaded(true);
      })
      .catch(() => {
        // API failed — keep defaults
        setLoaded(true);
      });

    return () => controller.abort();
  }, [isAuthenticated]);

  // Debounced save to API — always reads latest values from ref
  const persistSettings = useCallback(() => {
    if (!isAuthenticated || !loaded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveUserSettings(settingsRef.current).catch(() => {
        // Save failed silently — settings remain in-memory
      });
    }, 500);
  }, [isAuthenticated, loaded]);

  const setMode = useCallback(
    (m: ReadingMode) => {
      setModeState(m);
      persistSettings();
    },
    [persistSettings],
  );

  const setLang = useCallback(
    (l: TranslationLang) => {
      setLangState(l);
      persistSettings();
    },
    [persistSettings],
  );

  const setFontScale = useCallback(
    (s: number) => {
      setFontScaleState(s);
      persistSettings();
    },
    [persistSettings],
  );

  const setShowTafseer = useCallback(
    (t: boolean) => {
      setShowTafseerState(t);
      persistSettings();
    },
    [persistSettings],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <ReaderSettingsContext.Provider
      value={{
        mode,
        setMode,
        lang,
        setLang,
        fontScale,
        setFontScale,
        showTafseer,
        setShowTafseer,
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
          onModeChange={setMode}
          lang={lang}
          onLangChange={setLang}
          fontScale={fontScale}
          onFontScaleChange={setFontScale}
          showTafseer={showTafseer}
          onTafseerChange={setShowTafseer}
        />
      )}
    </ReaderSettingsContext.Provider>
  );
}
