import Icon from "@/components/ui/icon";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import styles from "./bismillah-block.module.css";

interface BismillahBlockProps {
  arabic: string;
  translation?: string;
  explanation?: string;
  lang?: "urdu" | "english" | "hindi";
  fontScale?: number;
  className?: string;
  onClick?: () => void;
}

export default function BismillahBlock({ arabic, translation, explanation, lang = "urdu", fontScale = 1, className = "", onClick }: BismillahBlockProps) {
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
      {explanation && (
        <div
          className={styles.explanation}
          dir={isRtl ? "rtl" : "ltr"}
          lang={langCode}
          style={{
            fontSize: `${explanationSize}rem`,
            fontFamily: translationFontFamily,
            lineHeight: isRtl ? "var(--leading-urdu)" : undefined,
          }}
          dangerouslySetInnerHTML={{ __html: explanation }}
        />
      )}
    </div>
  );
}
