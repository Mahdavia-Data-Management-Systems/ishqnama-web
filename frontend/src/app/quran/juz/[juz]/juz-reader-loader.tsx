"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useJuzVerses } from "@/hooks/use-juz-verses";
import { addHistoryEntry } from "@/lib/user-api";
import { apiFetchWithOptionalAuth } from "@/lib/api-client";
import type { TranslationLang } from "@/components/reader-toolbar";
import type { JuzDto } from "@/types/api";
import JuzHeader from "@/components/scripture/juz-header";
import QuranReaderClient from "@/components/scripture/quran-reader-client";

interface Props {
  juzNumber: number;
  prev: { href: string; name: string } | null;
  next: { href: string; name: string } | null;
}

export default function JuzReaderLoader({ juzNumber, prev, next }: Props) {
  const isAuthenticated = useIsAuthenticated();
  const searchParams = useSearchParams();
  const { lang: persistedLang } = useReaderSettings();

  const qLang = searchParams.get("lang");
  const [lang, setLang] = useState<TranslationLang>(
    qLang === "english" || qLang === "hindi" || qLang === "urdu" ? qLang : persistedLang,
  );

  useEffect(() => {
    if (!searchParams.get("lang")) setLang(persistedLang);
  }, [persistedLang, searchParams]);

  const { verses, loading, error, retry } = useJuzVerses(juzNumber, lang);

  // Fetch juz metadata for header
  const [meta, setMeta] = useState<JuzDto | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetchWithOptionalAuth<JuzDto[]>("/juz").then((data) => {
      if (!cancelled) {
        const found = data.find((j) => j.juzNumber === juzNumber);
        if (found) setMeta(found);
      }
    });
    return () => { cancelled = true; };
  }, [juzNumber]);

  // Record reading history
  useEffect(() => {
    if (!isAuthenticated || !meta) return;
    addHistoryEntry(`Juz ${juzNumber} — ${meta.transliteratedName}`, `/quran/juz/${juzNumber}/`).catch(() => { /* silent */ });
  }, [isAuthenticated, juzNumber, meta]);

  const range = meta
    ? `${meta.startChapter}:${meta.startVerse} — ${meta.endChapter}:${meta.endVerse}`
    : undefined;

  return (
    <>
      <JuzHeader
        juzNumber={juzNumber}
        arabicName={meta?.arabicName ?? ""}
        transliteratedName={meta?.transliteratedName ?? `Juz ${juzNumber}`}
        range={range}
      />
      <QuranReaderClient
        verses={verses}
        loading={loading}
        error={error}
        retry={retry}
        lang={lang}
        onLangChange={setLang}
        prev={prev}
        next={next}
      />
    </>
  );
}
