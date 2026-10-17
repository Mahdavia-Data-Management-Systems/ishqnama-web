import Link from "next/link";
import { notFound } from "next/navigation";
import EssayGate from "@/components/articles/essay-gate";
import EssayReader from "@/components/articles/essay-reader";
import BackToTop from "@/components/ui/back-to-top";
import {
  NOOR_E_IMAAN_ESSAY_BY_SLUG,
  essayNeighbours,
  essayPath,
  essayStaticParams,
} from "@/data/articles/nooreimaan";
import { pageMetadata } from "@/lib/page-metadata";
import type { EssayMeta } from "@/types/articles";
import styles from "./essay.module.css";

export const dynamicParams = false;
export const generateStaticParams = essayStaticParams;

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

/** The essay's text, under the head the layout gives both of its pages. */
export default async function EssayPage({ params }: EssayPageProps) {
  const { slug } = await params;
  const essay = NOOR_E_IMAAN_ESSAY_BY_SLUG.get(slug);
  if (!essay) notFound();
  const { previous, next } = essayNeighbours(slug);

  return (
    <>
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

      <BackToTop />
    </>
  );
}
