import { notFound } from "next/navigation";
import {
  NOOR_E_IMAAN_ESSAY_BY_SLUG,
  essayReflections,
  reflectionsPath,
  reflectionsStaticParams,
} from "@/data/articles/nooreimaan";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./reflections.module.css";

export const dynamicParams = false;
export const generateStaticParams = reflectionsStaticParams;

interface ReflectionsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ReflectionsPageProps) {
  const { slug } = await params;
  const essay = NOOR_E_IMAAN_ESSAY_BY_SLUG.get(slug);
  if (!essay || essayReflections(slug).length === 0) return {};
  return pageMetadata({
    title: `Reflections on ${essay.title}`,
    description: `Recorded discussions of ${essay.urduTitle}: ${essay.title}, an essay from Noor e Imaan.`,
    path: reflectionsPath(slug),
  });
}

/**
 * The recorded discussions about an essay, under the head the layout gives both of its pages.
 * Only an essay with recordings has this page. For now it names each recording by its caption
 * and description; how they are heard here is to be designed.
 */
export default async function ReflectionsPage({ params }: ReflectionsPageProps) {
  const { slug } = await params;
  const reflections = essayReflections(slug);
  if (!NOOR_E_IMAAN_ESSAY_BY_SLUG.has(slug) || reflections.length === 0) notFound();

  return (
    <section className={styles.reflections} aria-label="Reflections">
      <ol className={styles.list}>
        {reflections.map((reflection) => (
          <li key={reflection.url} className={styles.item}>
            <h2 className={styles.caption}>{reflection.caption ?? reflection.title}</h2>
            {reflection.description && <p className={styles.description}>{reflection.description}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
