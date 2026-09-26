import QuranIndex from "@/components/scripture/quran-index";
import styles from "./page.module.css";

export default function QuranIndexPage() {
  return (
    <main className={styles.main}>
      <div className="page-container">
        <QuranIndex />
      </div>
    </main>
  );
}
