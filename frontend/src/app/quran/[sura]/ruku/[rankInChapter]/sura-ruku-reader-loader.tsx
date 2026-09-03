"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useRukuVerses } from "@/hooks/use-ruku-verses";
import { addHistoryEntry } from "@/lib/user-api";
import type { TranslationLang } from "@/components/reader-toolbar";
import RukuHeader from "@/components/scripture/ruku-header";
import QuranReaderClient from "@/components/scripture/quran-reader-client";

interface Props {
  suraNumber: number;
  suraName: string;
  rank: number;
  totalRukus: number;
  prev: { href: string; name: string } | null;
  next: { href: string; name: string } | null;
}

export default function SuraRukuReaderLoader({
  suraNumber,
  suraName,
  rank,
  totalRukus,
  prev,
  next,
}: Props) {
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

  const { ruku, verses, loading, error, retry } = useRukuVerses(
    { chapterNum: suraNumber, rankInChapter: rank },
    lang,
  );

  // Record reading history
  useEffect(() => {
    if (!isAuthenticated) return;
    addHistoryEntry(
      `${suraName} — Ruku ${rank}`,
      `/quran/${suraNumber}/ruku/${rank}/`,
    ).catch(() => { /* silent */ });
  }, [isAuthenticated, suraNumber, rank]); // eslint-disable-line react-hooks/exhaustive-deps -- suraName is stable per suraNumber; key={`${suraNumber}-${rank}`} remounts on nav

  return (
    <>
      <RukuHeader
        rank={rank}
        totalRukus={totalRukus}
        parentLabel={suraName}
        verseCount={ruku?.verseCount}
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
