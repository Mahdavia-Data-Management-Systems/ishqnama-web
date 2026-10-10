import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleShareButton from "@/components/articles/article-share-button";
import EssayGate from "@/components/articles/essay-gate";
import EssayReader from "@/components/articles/essay-reader";
import {
  NOOR_E_IMAAN_ESSAYS,
  NOOR_E_IMAAN_ESSAY_BY_SLUG,
  essayNeighbours,
  essayPath,
} from "@/data/articles/nooreimaan";
import { pageMetadata } from "@/lib/page-metadata";
import type { EssayMeta } from "@/types/articles";
import styles from "./essay.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return NOOR_E_IMAAN_ESSAYS.map(({ slug }) => ({ slug }));
}

interface EssayPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EssayPageProps) {
  const { slug } = await params;
  const essay = NOOR_E_IMAAN_ESSAY_BY_SLUG.get(slug);
  if (!essay) return {};
  return pageMetadata({
    title: essay.title,
    description: `${essay.urduTitle}: ${essay.title}, an essay from Noor e Imaan.`,
    path: essayPath(slug),
  });
}

function Neighbour({ essay, rel }: { essay: EssayMeta; rel: "prev" | "next" }) {
  return (
    <Link href={essayPath(essay.slug)} rel={rel} className={`${styles.neighbour} ${styles[rel]}`}>
      <span className={styles.direction}>{rel === "prev" ? "Previous" : "Next"}</span>
      <span className={styles.neighbourTitle} lang="ur">
        {essay.urduTitle}
      </span>
    </Link>
  );
}

export default async function EssayPage({ params }: EssayPageProps) {
  const { slug } = await params;
  const essay = NOOR_E_IMAAN_ESSAY_BY_SLUG.get(slug);
  if (!essay) notFound();
  const { previous, next } = essayNeighbours(slug);

  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title} lang="ur" dir="rtl">
            <span className={styles.bracket} aria-hidden="true">﴿</span>
            {essay.urduTitle}
            <span className={styles.bracket} aria-hidden="true">﴾</span>
          </h1>
          <p className={styles.subtitle}>{essay.title}</p>
        </div>
        <div className={styles.share}>
          <ArticleShareButton
            path={essayPath(slug)}
            title={essay.title}
            text={`Noor-e-Imaan | ${essay.urduTitle}\n${essay.title}\n`}
            page="essay"
          />
        </div>
      </header>

      <EssayReader
        prev={previous && { href: essayPath(previous.slug), name: previous.title }}
        next={next && { href: essayPath(next.slug), name: next.title }}
      >
        <EssayGate slug={slug} />
      </EssayReader>

      <nav className={styles.foot} aria-label="More essays">
        {/* RTL, as the book reads: the previous essay on the right, the next on the left */}
        <div className={styles.neighbours} dir="rtl">
          {previous && <Neighbour essay={previous} rel="prev" />}
          {next && <Neighbour essay={next} rel="next" />}
        </div>
      </nav>
    </main>
  );
}
