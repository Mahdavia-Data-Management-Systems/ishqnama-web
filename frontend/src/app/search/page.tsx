"use client";

import { useState, useEffect, useRef } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "@/config/auth-config";
import SearchField from "@/components/ui/search-field";
import SegmentedControl from "@/components/ui/segmented-control";
import EmptyState from "@/components/empty-state";
import SectionHeading from "@/components/navigation/section-heading";
import SearchResultCard from "@/components/search-result-card";
import { searchQuran } from "@/lib/api";
import type { SearchResultDto } from "@/types/api";
import styles from "./page.module.css";

const tabOptions = [
  { label: "Both", value: "both", shortLabel: "Both", ariaLabel: "Both" },
  { label: "Tarjuma", value: "tarjuma", shortLabel: "Trjm", ariaLabel: "Tarjuma" },
  { label: "Tafseer", value: "tafseer", shortLabel: "Tfsr", ariaLabel: "Tafseer" },
];

const langOptions = [
  { label: "English", value: "english", shortLabel: "En", ariaLabel: "English" },
  { label: "हिन्दी", value: "hindi", shortLabel: "हि", ariaLabel: "हिन्दी" },
  { label: "اردو", value: "urdu", shortLabel: "ار", ariaLabel: "اردو" },
];

const placeholders: Record<string, string> = {
  urdu: "قرآنی ترجمہ یا تفسیر میں تلاش کریں",
  english: "Search in quranic translation or explanation",
  hindi: "कुरानी अनुवाद या तफ़सीर में खोजें",
};

function getTranslationId(lang: string): number {
  switch (lang) {
    case "english":
      return 1;
    case "urdu":
      return 2;
    case "hindi":
      return 3;
    default:
      return 2;
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("both");
  const [lang, setLangState] = useState("urdu");

  const setLang = (l: string) => {
    setLangState(l);
    setQuery("");
  };
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);

  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();
  const abortRef = useRef<AbortController | null>(null);

  const translationId = getTranslationId(lang);
  const inputFontFamily =
    lang === "urdu"
      ? "var(--font-urdu)"
      : lang === "hindi"
        ? "var(--font-hindi)"
        : "var(--font-display)";
  const inputDir = lang === "urdu" ? "rtl" as const : "ltr" as const;
  const pageSize = 20;

  // Debounced search on query/tab/lang change
  useEffect(() => {
    if (!isAuthenticated || query.length < 2) {
      setResults([]);
      setTotalCount(0);
      setSearched(false);
      setError(false);
      return;
    }

    setPage(1);
    const timeout = setTimeout(() => {
      performSearch(query, tab, 1);
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab, translationId, isAuthenticated]);

  function performSearch(q: string, scope: string, p: number) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);
    searchQuran(q, scope, { translationId, page: p, pageSize }, controller.signal)
      .then((data) => {
        if (p === 1) {
          setResults(data.items);
        } else {
          setResults((prev) => [...prev, ...data.items]);
        }
        setTotalCount(data.totalCount);
        setPage(p);
        setSearched(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(true);
          setSearched(true);
        }
      })
      .finally(() => setLoading(false));
  }

  function loadMore() {
    performSearch(query, tab, page + 1);
  }

  const hasMore = results.length < totalCount;

  if (!isAuthenticated) {
    return (
      <main className={styles.main}>
        <div className="page-container">
          <SectionHeading eyebrow="Explore" title="Search" />
          <EmptyState
            icon="lock"
            title="Sign in to search"
            body="Log in to search across tarjuma and tafseer."
            action={{
              label: "Sign in",
              onClick: () => instance.loginRedirect(loginRequest),
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="Explore" title="Search" />

        <div className={styles.searchBar}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={placeholders[lang] ?? "Search the Quran"}
            autoFocus
            inputStyle={{ fontFamily: inputFontFamily }}
            dir={inputDir}
          />
        </div>

        <div className={styles.filters}>
          <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />
          <SegmentedControl options={langOptions} value={lang} onChange={setLang} />
        </div>

        <div className={styles.results}>
          {!searched && !loading && (
            <EmptyState
              icon="search"
              title="Search in Noor e Imaan"
              body="Search anything across tarjuma and tafseer."
            />
          )}

          {searched && error && !loading && (
            <EmptyState
              icon="search"
              title="Something went wrong"
              body="Could not complete the search. Please try again."
            />
          )}

          {searched && !error && results.length === 0 && !loading && (
            <EmptyState
              icon="search"
              title="No results"
              body={`No results found for "${query}".`}
            />
          )}

          {results.length > 0 && (
            <>
              <p className={styles.resultCount}>
                {totalCount} result{totalCount !== 1 ? "s" : ""} found
              </p>
              <div className={styles.resultList}>
                {results.map((r) => (
                  <SearchResultCard
                    key={`${r.chapterNumber}:${r.verseNumber}`}
                    result={r}
                    query={query}
                    lang={lang}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  className={styles.loadMore}
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          )}

          {loading && results.length === 0 && (
            <p className={styles.loadingText}>Searching...</p>
          )}
        </div>
      </div>
    </main>
  );
}
