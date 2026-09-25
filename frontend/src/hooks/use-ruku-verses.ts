"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getRukuVerses } from "@/lib/api";
import { getTranslationId } from "@/lib/translation-map";
import { rukusInChapter, rukusInJuz } from "@/data/rukus";
import type { TranslationLang } from "@/components/scripture/ayah-block";
import { toDisplayVerse, type DisplayVerse } from "@/hooks/use-chapter-verses";

type RukuLookup =
  | { chapterNum: number; rankInChapter: number }
  | { juzNum: number; rankInJuz: number };

export function useRukuVerses(lookup: RukuLookup, lang: TranslationLang) {
  const isChapter = "chapterNum" in lookup;
  const chapterNum = isChapter ? lookup.chapterNum : undefined;
  const juzNum = isChapter ? undefined : lookup.juzNum;
  const rankInChapter = isChapter ? lookup.rankInChapter : undefined;
  const rankInJuz = isChapter ? undefined : lookup.rankInJuz;

  // The ruku list is static data, so the rukuId resolves without a request
  const ruku = useMemo(
    () =>
      (chapterNum !== undefined
        ? rukusInChapter(chapterNum).find((r) => r.rankInChapter === rankInChapter)
        : rukusInJuz(juzNum!).find((r) => r.rankInJuz === rankInJuz)) ?? null,
    [chapterNum, juzNum, rankInChapter, rankInJuz],
  );

  const [verses, setVerses] = useState<DisplayVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!ruku) {
      setError("Ruku not found");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetch(rukuId: number) {
      setLoading(true);
      setError(null);

      try {
        const translationId = getTranslationId(lang);
        const dtos = await getRukuVerses(rukuId, translationId, signal);

        if (!signal.aborted) {
          setVerses(dtos.map(toDisplayVerse));
          setLoading(false);
        }
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load verses");
        setLoading(false);
      }
    }

    fetch(ruku.rukuId);
    return () => controller.abort();
  }, [ruku, lang, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { ruku, verses, loading, error, retry };
}
