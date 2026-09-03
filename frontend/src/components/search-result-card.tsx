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

interface SearchResultCardProps {
  result: SearchResultDto;
  query: string;
  lang: string;
}

export default function SearchResultCard({ result, query, lang }: SearchResultCardProps) {
  const fontFamily =
    lang === "urdu"
      ? "var(--font-urdu)"
      : lang === "hindi"
        ? "var(--font-hindi)"
        : "var(--font-display)";
  const isRtl = lang === "urdu";
  const langCode = lang === "urdu" ? "ur" : lang === "hindi" ? "hi" : "en";

  const textFragment = encodeURIComponent(query).replace(/-/g, "%2D");

  return (
    <Link href={`/quran/${result.chapterNumber}/?verse=${result.verseNumber}&highlight=${encodeURIComponent(query)}#:~:text=${textFragment}`} className={styles.card}>
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
          {highlightText(result.translationText, query)}
        </p>
      )}
      {result.explanation && (
        <p
          className={styles.explanation}
          style={{ fontFamily }}
          dir={isRtl ? "rtl" : undefined}
          lang={langCode}
          dangerouslySetInnerHTML={{
            __html: highlightHtml(result.explanation, query),
          }}
        />
      )}
    </Link>
  );
}
