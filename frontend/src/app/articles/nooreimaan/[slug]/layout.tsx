import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import EssayShareButton from "@/components/articles/essay-share-button";
import EssayStickyBar from "@/components/articles/essay-sticky-bar";
import EssayTabs from "@/components/articles/essay-tabs";
import Icon from "@/components/ui/icon";
import { NOOR_E_IMAAN_ESSAY_BY_SLUG, essayReflections, essayStaticParams } from "@/data/articles/nooreimaan";
import styles from "./essay.module.css";

export const dynamicParams = false;
export const generateStaticParams = essayStaticParams;

const ESSAY_TITLE_ID = "essay-title";

interface EssayLayoutProps {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}

/**
 * The head shared by an essay's two pages, Article and Reflections: the pinned row with the way
 * back and Share, the title in the book's brackets, and the row of tabs between the pages. Each
 * page fills in what follows. An essay with no recordings has no Reflections page, so it shows
 * no tabs at all.
 */
export default async function EssayLayout({ params, children }: EssayLayoutProps) {
  const { slug } = await params;
  const essay = NOOR_E_IMAAN_ESSAY_BY_SLUG.get(slug);
  if (!essay) notFound();

  return (
    <main className={styles.main}>
      {/* A child of <main>, not the header, so it stays pinned for the whole essay */}
      <EssayStickyBar
        className={styles.bar}
        title={essay.urduTitle}
        titleId={ESSAY_TITLE_ID}
        start={
          <Link href="/articles/" className={styles.back}>
            <Icon name="chevronLeft" size={16} />
            Articles
          </Link>
        }
        end={
          <div className={styles.share}>
            {/* Shares the page that is showing: the essay, or its reflections */}
            <EssayShareButton slug={slug} title={essay.title} urduTitle={essay.urduTitle} />
          </div>
        }
      />

      <header className={styles.head}>
        <h1 id={ESSAY_TITLE_ID} className={styles.title} lang="ur" dir="rtl">
          <span className={styles.bracket} aria-hidden="true">﴿</span>
          {essay.urduTitle}
          <span className={styles.bracket} aria-hidden="true">﴾</span>
        </h1>
        <p className={styles.subtitle}>{essay.title}</p>
      </header>

      {essayReflections(slug).length > 0 && <EssayTabs slug={slug} />}

      {children}
    </main>
  );
}
