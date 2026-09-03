"use client";

import { useState, useEffect, useCallback } from "react";
import { getJuzVerses } from "@/lib/api";
import { getTranslationId } from "@/lib/translation-map";
import type { VerseDto } from "@/types/api";
import type { TranslationLang } from "@/components/scripture/ayah-block";
import { toDisplayVerse, type DisplayVerse } from "@/hooks/use-chapter-verses";

const PAGE_SIZE = 200;

export function useJuzVerses(juzNumber: number, lang: TranslationLang) {
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
        const translationId = getTranslationId(lang);

        const firstPage = await getJuzVerses(
          juzNumber,
          { translationId, page: 1, pageSize: PAGE_SIZE },
          signal,
        );

        const allDtos: VerseDto[] = [...firstPage.items];
        const totalPages = Math.ceil(firstPage.totalCount / PAGE_SIZE);

        if (totalPages > 1) {
          const remaining = Array.from(
            { length: totalPages - 1 },
            (_, i) =>
              getJuzVerses(
                juzNumber,
                { translationId, page: i + 2, pageSize: PAGE_SIZE },
                signal,
              ),
          );
          const pages = await Promise.all(remaining);
          for (const page of pages) {
            allDtos.push(...page.items);
          }
        }

        if (!signal.aborted) {
          setVerses(allDtos.map(toDisplayVerse));
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
  }, [juzNumber, lang, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { verses, loading, error, retry };
}
