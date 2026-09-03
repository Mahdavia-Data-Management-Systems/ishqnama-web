import Link from "next/link";
import type { SearchResultDto } from "@/types/api";
import styles from "./search-result-card.module.css";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={styles.highlight}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function highlightHtml(html: string, query: string) {
  if (!query) return html;
  const escaped = escapeRegExp(query);
  const matchRegex = new RegExp(escaped, "gi");
  // Split into tags and text segments, only highlight within text
  return html.replace(/(<[^>]*>)|([^<]+)/g, (segment, tag, text) => {
    if (tag) return tag;
    return text.replace(
      matchRegex,
      (m: string) => `<mark class="${styles.highlight}">${m}</mark>`,
    );
  });
}

function trimTextAroundQuery(text: string, query: string, contextChars = 80): string {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;

  let start = Math.max(0, idx - contextChars);
  let end = Math.min(text.length, idx + query.length + contextChars);

  if (start > 0) {
    const ws = text.indexOf(" ", start);
    if (ws !== -1 && ws < idx) start = ws + 1;
  }
  if (end < text.length) {
    const ws = text.lastIndexOf(" ", end);
    if (ws > idx + query.length) end = ws;
  }

  const prefix = start > 0 ? "\u2026" : "";
  const suffix = end < text.length ? "\u2026" : "";
  return prefix + text.slice(start, end) + suffix;
}

function trimHtmlAroundQuery(html: string, query: string, contextChars = 80): string {
  if (!query || !html) return html;

  const plainText = html.replace(/<[^>]*>/g, "");
  const idx = plainText.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return html;

  let start = Math.max(0, idx - contextChars);
  let end = Math.min(plainText.length, idx + query.length + contextChars);

  if (start > 0) {
    const ws = plainText.indexOf(" ", start);
    if (ws !== -1 && ws < idx) start = ws + 1;
  }
  if (end < plainText.length) {
    const ws = plainText.lastIndexOf(" ", end);
    if (ws > idx + query.length) end = ws;
  }

  const startTrimmed = start > 0;
  const endTrimmed = end < plainText.length;

  let textPos = 0;
  let result = "";
  const segmentRegex = /(<[^>]*>)|([^<]+)/g;
  let m;
  while ((m = segmentRegex.exec(html)) !== null) {
    const [, tag, text] = m;
    if (tag) {
      if (textPos >= start && textPos <= end) result += tag;
    } else if (text) {
      const segEnd = textPos + text.length;
      if (segEnd > start && textPos < end) {
        const from = Math.max(0, start - textPos);
        const to = Math.min(text.length, end - textPos);
        result += text.slice(from, to);
      }
      textPos += text.length;
    }
  }

  return (startTrimmed ? "\u2026" : "") + result + (endTrimmed ? "\u2026" : "");
}

interface SearchResultCardProps {
  result: SearchResultDto;
  query: string;
  lang: string;
  searchScope: string;
}

export default function SearchResultCard({ result, query, lang, searchScope }: SearchResultCardProps) {
  const fontFamily =
    lang === "urdu"
      ? "var(--font-urdu)"
      : lang === "hindi"
        ? "var(--font-hindi)"
        : "var(--font-display)";
  const isRtl = lang === "urdu";
  const langCode = lang === "urdu" ? "ur" : lang === "hindi" ? "hi" : "en";

  const textFragment = encodeURIComponent(query).replace(/-/g, "%2D");
  const showTafseer = searchScope === "both" || searchScope === "tafseer";
  const href = `/quran/${result.chapterNumber}/?verse=${result.verseNumber}&mode=verse&lang=${lang}${showTafseer ? "&tafseer=true" : ""}&highlight=${encodeURIComponent(query)}#:~:text=${textFragment}`;

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.meta}>
        <span className={styles.ref}>
          {result.chapterName} {result.chapterNumber}:{result.verseNumber}
        </span>
      </div>
      <p className={styles.arabic} dir="rtl" lang="ar">
        {result.arabicText}
      </p>
      <hr className="hairline-gold" />
      {result.translationText && (
        <p
          className={styles.translation}
          style={{ fontFamily }}
          dir={isRtl ? "rtl" : undefined}
          lang={langCode}
        >
          {highlightText(trimTextAroundQuery(result.translationText, query), query)}
        </p>
      )}
      {result.explanation && (
        <p
          className={styles.explanation}
          style={{ fontFamily }}
          dir={isRtl ? "rtl" : undefined}
          lang={langCode}
          dangerouslySetInnerHTML={{
            __html: highlightHtml(trimHtmlAroundQuery(result.explanation, query), query),
          }}
        />
      )}
    </Link>
  );
}
