import Link from "next/link";
import { NOOR_E_IMAAN_ESSAYS, essayPath } from "@/data/articles/nooreimaan";
import { KHATM_DUA_TITLE } from "@/data/khatm-dua";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./articles.module.css";

export const metadata = pageMetadata({
  title: "Articles",
  description: "Essays from Noor e Imaan on the Quran and the Mahdavi faith.",
  path: "/articles/",
});

/** One row: the English title on the left, the Urdu on the right, the whole row one link. */
function EssayRow({ href, title, urduTitle, urduLang = "ur" }: { href: string; title: string; urduTitle: string; urduLang?: string }) {
  return (
    <Link href={href} className={styles.row}>
      <span className={styles.english}>{title}</span>
      <span className={styles.urdu} lang={urduLang} dir="rtl">
        {urduTitle}
      </span>
    </Link>
  );
}

export default function ArticlesPage() {
  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <h1 className={styles.title}>Articles</h1>
        <p className={styles.subtitle}>Essays from Noor e Imaan</p>
      </header>

      {/* One section per source; later sources append below. */}
      <section aria-labelledby="nooreimaan">
        <h2 id="nooreimaan" className={styles.source}>
          Noor e Imaan
        </h2>
        <ul className={styles.list}>
          {NOOR_E_IMAAN_ESSAYS.map((essay) => (
            <li key={essay.slug}>
              <EssayRow href={essayPath(essay.slug)} title={essay.title} urduTitle={essay.urduTitle} />
            </li>
          ))}
          {/* The book closes with the dua, which has its own page */}
          <li>
            <EssayRow href="/nooreimaan/dua/" title="Dua for completing the Quran" urduTitle={KHATM_DUA_TITLE} urduLang="ar" />
          </li>
        </ul>
      </section>
    </main>
  );
}
