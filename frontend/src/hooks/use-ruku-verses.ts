"use client";

import { useState, useEffect, useCallback } from "react";
import { getRukus, getRukuVerses } from "@/lib/api";
import { getTranslationId } from "@/lib/translation-map";
import type { RukuDto } from "@/types/api";
import type { TranslationLang } from "@/components/scripture/ayah-block";
import { toDisplayVerse, type DisplayVerse } from "@/hooks/use-chapter-verses";

interface RukuLookup {
  chapterNum?: number;
  juzNum?: number;
  rankInChapter?: number;
  rankInJuz?: number;
}

export function useRukuVerses(lookup: RukuLookup, lang: TranslationLang) {
  const [ruku, setRuku] = useState<RukuDto | null>(null);
  const [verses, setVerses] = useState<DisplayVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        // Step 1: resolve rukuId via getRukus with chapter or juz filter
        const rukus = await getRukus(
          { chapterNum: lookup.chapterNum, juzNum: lookup.juzNum },
          signal,
        );

        const found = rukus.find((r) =>
          lookup.rankInChapter !== undefined
            ? r.rankInChapter === lookup.rankInChapter
            : r.rankInJuz === lookup.rankInJuz,
        );

        if (!found) {
          setError("Ruku not found");
          setLoading(false);
          return;
        }

        setRuku(found);

        // Step 2: fetch verses for this ruku
        const translationId = getTranslationId(lang);
        const dtos = await getRukuVerses(found.rukuId, translationId, signal);

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

    fetch();
    return () => controller.abort();
  }, [lookup.chapterNum, lookup.juzNum, lookup.rankInChapter, lookup.rankInJuz, lang, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { ruku, verses, loading, error, retry };
}
