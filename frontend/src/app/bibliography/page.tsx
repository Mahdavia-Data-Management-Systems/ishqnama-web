"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import BibliographyMap, { type BibliographyMapHandle } from "@/components/bibliography/bibliography-map";
import Sheet from "@/components/lists/sheet";
import CitationList from "@/components/scripture/citation-list";
import { BIBLIOGRAPHY_COPY } from "@/config/bibliography-copy";
import { TRY_AGAIN_LABEL, UNREACHABLE_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";
import { TAFSEER_COPY } from "@/config/tafseer-copy";
import { useSignInGate, useSignInPrompt } from "@/context/sign-in-prompt-context";
import { useBibliography } from "@/hooks/use-bibliography";
import { useApiReadiness } from "@/lib/api-readiness";
import {
  citationsByVerse,
  crumbs,
  pathAfterSelecting,
  validPath,
  visibleTree,
  type BibliographyPath,
  type MapNode,
} from "@/lib/bibliography-graph";
import { verseReference } from "@/lib/share-verse";
import { routePattern, trackEvent } from "@/lib/telemetry";
import styles from "./bibliography.module.css";

type CitationNode = Extract<MapNode, { kind: "citation" }>;

/**
 * Every book the takhreej cites, as a brace map that fills the screen: the eras the authors
 * died in, an era's authors, an author's books, then the chapters, rukus, ayaat and citations
 * that use a book. Eras, authors and books are open to everyone; opening a book needs an
 * account, since takhreej is part of the tafseer. The trail shows where the reader is and steps
 * back up the branch.
 */
export default function BibliographyPage() {
  const isAuthenticated = useIsAuthenticated();
  const { authSettled } = useSignInPrompt();
  const gate = useSignInGate("bibliography");
  const { books, failed, retry } = useBibliography(authSettled, isAuthenticated);
  const readiness = useApiReadiness();
  const pathname = usePathname() ?? "";

  const [chosenPath, setChosenPath] = useState<BibliographyPath>({});
  const [opened, setOpened] = useState<CitationNode | null>(null);
  const mapRef = useRef<BibliographyMapHandle>(null);

  const byVerse = useMemo(() => (books ? citationsByVerse(books) : null), [books]);
  const path = useMemo(() => (books ? validPath(books, chosenPath) : {}), [books, chosenPath]);
  const tree = useMemo(
    () => (books && byVerse ? visibleTree(books, path, byVerse) : null),
    [books, byVerse, path],
  );

  const select = useCallback(
    (node: MapNode) => {
      if (node.kind === "citation") {
        setOpened(node);
        trackEvent("bibliography-citation-opened", { route: routePattern(pathname) });
        return;
      }
      const open = () => setChosenPath((current) => pathAfterSelecting(current, node));
      // The books are for everyone; what a book opens into is takhreej, for signed-in readers.
      // Closing an open book needs no account.
      if (node.kind === "book" && !node.open) gate(open);
      else open();
    },
    [gate, pathname],
  );
  const closeSheet = useCallback(() => setOpened(null), []);

  if (!books || !tree) {
    // While warming or unreachable the hook retries on its own once the API is ready
    const waiting = readiness === "warming" || readiness === "unreachable" || !failed;
    const message =
      readiness === "warming" ? WARMING_MESSAGE
      : readiness === "unreachable" ? UNREACHABLE_MESSAGE
      : failed ? BIBLIOGRAPHY_COPY.failed
      : BIBLIOGRAPHY_COPY.opening;
    return (
      <main className={styles.main}>
        <div className={styles.placeholder}>
          <h1 className={styles.title}>{BIBLIOGRAPHY_COPY.title}</h1>
          {waiting && <div className={styles.spinner} />}
          <p className={styles.placeholderText}>{message}</p>
          {!waiting && (
            <button type="button" className={styles.retryButton} onClick={retry}>
              {TRY_AGAIN_LABEL}
            </button>
          )}
        </div>
      </main>
    );
  }

  const trail = crumbs(books, path, BIBLIOGRAPHY_COPY.allEras);
  const atHome = trail.length === 1;

  return (
    <main className={styles.main}>
      <BibliographyMap ref={mapRef} tree={tree} onSelect={select} className={styles.map} />

      <div className={styles.panel}>
        <h1 className={styles.title}>{BIBLIOGRAPHY_COPY.title}</h1>
        {atHome ? (
          <p className={styles.intro}>
            {BIBLIOGRAPHY_COPY.intro}. {BIBLIOGRAPHY_COPY.hint}.
          </p>
        ) : (
          <nav aria-label={BIBLIOGRAPHY_COPY.trail}>
            <ol className={styles.trail}>
              {trail.map((crumb, i) => {
                const last = i === trail.length - 1;
                return (
                  <li key={i} className={styles.crumb}>
                    <button
                      type="button"
                      className={styles.crumbButton}
                      lang={crumb.arabic ? "ar" : undefined}
                      aria-current={last ? "true" : undefined}
                      onClick={() => setChosenPath(crumb.path)}
                    >
                      {crumb.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>

      <button type="button" className={styles.fitButton} onClick={() => mapRef.current?.fit()}>
        {BIBLIOGRAPHY_COPY.showAll}
      </button>

      {opened &&
        createPortal(
          <Sheet
            onClose={closeSheet}
            title={TAFSEER_COPY.takhreej}
            subtitle={verseReference(opened.citation.chapterNumber, opened.citation.verseNumber)}
          >
            {opened.dimmed && <p className={styles.otherBook}>{BIBLIOGRAPHY_COPY.otherBook}</p>}
            <CitationList
              citations={[
                {
                  title: opened.book.title,
                  author: opened.book.author,
                  authorDeathYearHijri: opened.book.authorDeathYearHijri,
                  reference: opened.citation.reference,
                  note: opened.citation.note,
                  url: opened.citation.url,
                },
              ]}
            />
            <Link
              className={styles.openAyah}
              href={`/quran/${opened.citation.chapterNumber}/?verse=${opened.citation.verseNumber}`}
            >
              {BIBLIOGRAPHY_COPY.openAyah}
            </Link>
          </Sheet>,
          document.body,
        )}
    </main>
  );
}
