import styles from "../static-page.module.css";

export default function ContactPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>Get in touch</span>
        <h1 className={styles.title}>Contact</h1>
        <div className={styles.body}>
          <p>
            We welcome your feedback, corrections, and suggestions for improving
            Ishqnama.
          </p>
          <p>
            For questions, support requests, or to report an issue, please reach
            out to the Mahdavia Data Management System team.
          </p>
        </div>
      </div>
    </main>
  );
}
