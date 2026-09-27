"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useJuzVerses } from "@/hooks/use-juz-verses";
import { addHistoryEntry } from "@/lib/user-api";
import { JUZ_BY_NUMBER } from "@/data/juz";
import type { TranslationLang } from "@/components/reader-toolbar";
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

  const meta = JUZ_BY_NUMBER.get(juzNumber);

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
