import Icon from "@/components/ui/icon";
import { year, type Citation } from "@/lib/tafseer-takhreej";
import styles from "./tafseer-html.module.css";

/**
 * Cited books, one per line, as the takhreej sheet lists them. Shared by the reader's sheet and
 * the bibliography page. A plain string is a line from an older cached response, shown as it is.
 */
export default function CitationList({ citations }: { citations: readonly (Citation | string)[] }) {
  return (
    <ol className={styles.list} dir="rtl" lang="ar">
      {citations.map((citation, i) => (
        <li key={i} className={styles.item}>
          {typeof citation === "string" ? citation : <CitationLines citation={citation} />}
        </li>
      ))}
    </ol>
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
