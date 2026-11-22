import { Fragment } from "react";
import TafseerHtml from "@/components/scripture/tafseer-html";
import Icon from "@/components/ui/icon";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import type { DisplaySegment } from "@/hooks/use-chapter-verses";
import styles from "./bismillah-block.module.css";

interface BismillahBlockProps {
  arabic?: string;
  translation?: string;
  /** The bismillah's translation segments; each one's explanation is shown, with its own takhreej. */
  segments?: DisplaySegment[];
  /** The reader's "Show takhreej on tafseer" setting. */
  showTakhreej?: boolean;
  lang?: "urdu" | "english" | "hindi";
  fontScale?: number;
  className?: string;
  onClick?: () => void;
}

export default function BismillahBlock({ arabic, translation, segments, showTakhreej = true, lang = "urdu", fontScale = 1, className = "", onClick }: BismillahBlockProps) {
  const isRtl = lang === "urdu";
  const langCode = isRtl ? "ur" : lang === "hindi" ? "hi" : "en";
  const scale = (FONT_SIZE_STEPS[fontScale] ?? 100) / 100;
  const arabicSize = Math.max(1.625, 1.75 * scale);
  const translationSize = Math.max(1.1875, 1.5 * scale);
  const explanationSize = Math.max(1, 1.125 * scale);
  const translationFontFamily =
    lang === "urdu" ? "var(--font-urdu)"
      : lang === "hindi" ? "var(--font-hindi)"
        : "var(--font-display)";

  // Anchor numbers are per segment, so each explanation is rendered with its own segment's books.
  const explained = segments?.filter((seg) => seg.explanation) ?? [];

  return (
    <div className={`${styles.wrapper} ornament-paper-tint ${className}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      {arabic ? (
        <div className={styles.arabic} dir="rtl" lang="ar" style={{ fontSize: `${arabicSize}rem` }}>
          {arabic}
        </div>
      ) : (
        <div className={styles.iconPlaceholder}>
          <Icon name="alignLeft" size={28} />
        </div>
      )}
      {translation && (
        <div
          className={styles.translation}
          dir={isRtl ? "rtl" : "ltr"}
          lang={langCode}
          style={{
            fontSize: `${translationSize}rem`,
            fontFamily: translationFontFamily,
            lineHeight: isRtl ? "var(--leading-urdu)" : undefined,
          }}
        >
          {translation}
        </div>
      )}
      {explained.length > 0 && (
        <div
          className={styles.explanation}
          dir={isRtl ? "rtl" : "ltr"}
          lang={langCode}
          style={{
            fontSize: `${explanationSize}rem`,
            fontFamily: translationFontFamily,
            lineHeight: isRtl ? "var(--leading-urdu)" : undefined,
          }}
        >
          {explained.map((seg, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <TafseerHtml html={seg.explanation!} takhreej={seg.takhreej} showTakhreej={showTakhreej} />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
