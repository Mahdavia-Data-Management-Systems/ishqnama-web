"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Sheet from "@/components/lists/sheet";
import Icon from "@/components/ui/icon";
import { TAFSEER_COPY } from "@/config/tafseer-copy";
import { highlightHtml } from "@/lib/highlight-html";
import {
  citationsFor,
  flattenTakhreej,
  splitTakhreej,
  year,
  type Citation,
} from "@/lib/tafseer-takhreej";
import { routePattern, trackEvent } from "@/lib/telemetry";
import type { TakhreejBlockDto } from "@/types/api";
import styles from "./tafseer-html.module.css";

interface TafseerHtmlProps {
  /** One segment's explanation, as the API returns it. */
  html: string;
  /** The segment's cited books, by the anchor number in `html`. */
  takhreej?: readonly TakhreejBlockDto[] | null;
  /** The reader's "Show takhreej on tafseer" setting; off, the passages read as ordinary prose. */
  showTakhreej?: boolean;
  /** Search text to mark in the prose and the passages (never in the books). */
  highlightQuery?: string;
  /** Class of the search marks; highlighting needs both this and `highlightQuery`. */
  markClassName?: string;
}

/**
 * A segment's tafseer. Passages that carry takhreej get a light gold wash and an open-book
 * button at their end, which lists the books in a sheet. Without any, it renders the single
 * span the reader always rendered, so the callers' `span[lang]` rules keep applying.
 */
export default function TafseerHtml({
  html,
  takhreej,
  showTakhreej = true,
  highlightQuery,
  markClassName,
}: TafseerHtmlProps) {
  const parts = useMemo(() => (showTakhreej ? splitTakhreej(html) : []), [html, showTakhreej]);
  const highlight = (text: string) =>
    highlightQuery && markClassName ? highlightHtml(text, highlightQuery, markClassName) : text;

  if (!showTakhreej || !parts.some((part) => part.kind === "takhreej")) {
    return <span dangerouslySetInnerHTML={{ __html: highlight(flattenTakhreej(html)) }} />;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === "html") {
          return <span key={i} dangerouslySetInnerHTML={{ __html: highlight(part.html) }} />;
        }
        const citations = citationsFor(part, takhreej);
        const passage = part.passageHtml ? (
          <span dangerouslySetInnerHTML={{ __html: highlight(part.passageHtml) }} />
        ) : null;
        // An anchor whose books did not arrive: the passage reads as ordinary prose.
        if (citations.length === 0) return <span key={i}>{passage}</span>;
        return (
          // The wash is on the wrapper, so it runs under the button too.
          <span key={i} className={passage ? styles.passage : undefined}>
            {passage && <mark className={styles.mark}>{passage}</mark>}
            <TakhreejButton passageHtml={part.passageHtml} citations={citations} />
          </span>
        );
      })}
    </>
  );
}

function TakhreejButton({
  passageHtml,
  citations,
}: {
  passageHtml: string;
  citations: Citation[] | string[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  // Stable, so the sheet does not re-register its Escape listener on every render.
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className={styles.button}
        aria-label={TAFSEER_COPY.showTakhreej}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          // The tafseer block around it toggles its own highlight on a click.
          e.stopPropagation();
          // Some browsers do not focus a clicked button; the sheet returns focus to whatever had it.
          e.currentTarget.focus();
          setOpen(true);
          trackEvent("takhreej-opened", { route: routePattern(pathname) });
        }}
      >
        <Icon name="bookOpen" className={styles.icon} />
      </button>
      {open &&
        // In the page's own chrome: in place it would inherit the tafseer's direction, font,
        // size, justification and pointer cursor.
        createPortal(
          <Sheet onClose={close} title={TAFSEER_COPY.takhreej}>
            {passageHtml && (
              <blockquote
                className={styles.quote}
                dir="rtl"
                lang="ur"
                aria-label={TAFSEER_COPY.passage}
                dangerouslySetInnerHTML={{ __html: passageHtml }}
              />
            )}
            <ol className={styles.list} dir="rtl" lang="ar">
              {citations.map((citation, i) => (
                <li key={i} className={styles.item}>
                  {typeof citation === "string" ? citation : <CitationLines citation={citation} />}
                </li>
              ))}
            </ol>
          </Sheet>,
          document.body,
        )}
    </>
  );
}

/** One book: its title, then author and year, then where in the book, then any note. */
function CitationLines({ citation }: { citation: Citation }) {
  const { title, author, authorDeathYearHijri, reference, note, url } = citation;
  // Only a secure address is ever linked, and the address itself is never printed.
  const href = url?.startsWith("https://") ? url : undefined;
  const meta = [author, authorDeathYearHijri != null ? year(authorDeathYearHijri) : null]
    .filter(Boolean)
    .join(" ");
  const link = (text: string) => (
    <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
      {/* Tells the reader this one leaves the site; the link's name stays the reference. */}
      <Icon name="externalLink" className={styles.linkIcon} />
      {text}
    </a>
  );

  return (
    <>
      <span className={styles.title}>{href && !reference ? link(title) : title}</span>
      {meta && <span className={styles.meta}> {meta}</span>}
      {reference && <span className={styles.reference}>{href ? link(reference) : reference}</span>}
      {note && <span className={styles.note}>{note}</span>}
    </>
  );
}
