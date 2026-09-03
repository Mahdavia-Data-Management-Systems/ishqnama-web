"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useChapterVerses } from "@/hooks/use-chapter-verses";
import { addHistoryEntry } from "@/lib/user-api";
import type { TranslationLang } from "@/components/reader-toolbar";
import QuranReaderClient from "@/components/scripture/quran-reader-client";

interface Props {
  suraNumber: number;
  suraName: string;
  prev: { href: string; name: string } | null;
  next: { href: string; name: string } | null;
}

export default function SuraReaderLoader({ suraNumber, suraName, prev, next }: Props) {
  const isAuthenticated = useIsAuthenticated();
  const searchParams = useSearchParams();
  const { lang: persistedLang } = useReaderSettings();

  const qLang = searchParams.get("lang");
  const [lang, setLang] = useState<TranslationLang>(
    qLang === "english" || qLang === "hindi" || qLang === "urdu" ? qLang : persistedLang,
  );

  // Sync from persisted → local when settings sheet changes (skip if query param override is active)
  useEffect(() => {
    if (!searchParams.get("lang")) setLang(persistedLang);
  }, [persistedLang, searchParams]);

  const { verses, loading, error, retry } = useChapterVerses(suraNumber, lang);

  // Record reading history
  useEffect(() => {
    if (!isAuthenticated) return;
    addHistoryEntry(suraName, `/quran/${suraNumber}/`).catch(() => { /* silent */ });
  }, [isAuthenticated, suraNumber]); // eslint-disable-line react-hooks/exhaustive-deps -- suraName is stable per suraNumber; key={suraNumber} remounts on nav

  return (
    <QuranReaderClient
      verses={verses}
      loading={loading}
      error={error}
      retry={retry}
      chapterNumber={suraNumber}
      chapterName={suraName}
      lang={lang}
      onLangChange={setLang}
      prev={prev}
      next={next}
    />
  );
}
