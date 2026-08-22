import styles from "./bismillah-block.module.css";

interface BismillahBlockProps {
  showTranslation?: boolean;
  className?: string;
}

export default function BismillahBlock({ showTranslation = true, className = "" }: BismillahBlockProps) {
  return (
    <div className={`${styles.wrapper} ornament-paper-tint ${className}`}>
      <div className={styles.arabic} dir="rtl" lang="ar">
        بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
      </div>
      <div className={styles.divider} aria-hidden="true">
        <span className={styles.dividerLine} />
        <span className={styles.dividerGlyph}>&#x2726;</span>
        <span className={styles.dividerLine} />
      </div>
      {showTranslation && (
        <div className={styles.translation} dir="rtl" lang="ur">
          شروع اللہ کے نام سے جو بڑا مہربان نہایت رحم والا ہے
        </div>
      )}
    </div>
  );
}
