import styles from "../static-page.module.css";

export default function AboutPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>About</span>
        <h1 className={styles.title}>Ishqnama</h1>
        <div className={styles.body}>
          <p>
            Ishqnama is a Quranic data platform providing the complete text of
            the Holy Quran alongside Urdu, Hindi, and English translations,
            together with tafseer and scholarly commentary.
          </p>
          <p>
            Our mission is to make the Quran accessible to readers across
            languages and traditions, with a focus on clarity, accuracy, and a
            reading experience worthy of the text.
          </p>
          <p>
            Built with care by the Mahdavia Data Management System project.
          </p>
        </div>
      </div>
    </main>
  );
}
