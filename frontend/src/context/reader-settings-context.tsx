"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import SettingsSheet from "@/components/settings-sheet";
import type { ReadingMode, TranslationLang } from "@/components/reader-toolbar";
import { DEFAULT_FONT_SIZE_INDEX } from "@/config/reader-config";

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

  const [mode, setMode] = useState<ReadingMode>("verse");
  const [lang, setLang] = useState<TranslationLang>("urdu");
  const [fontScale, setFontScale] = useState(DEFAULT_FONT_SIZE_INDEX);
  const [showTafseer, setShowTafseer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
