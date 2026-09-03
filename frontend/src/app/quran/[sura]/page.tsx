import { notFound } from "next/navigation";
import SuraHeader from "@/components/scripture/sura-header";
import { suras } from "@/data/suras";
import SuraReaderLoader from "./sura-reader-loader";
import styles from "./page.module.css";

export function generateStaticParams() {
  return Array.from({ length: 114 }, (_, i) => ({
    sura: String(i + 1),
  }));
}

export default async function SuraReaderPage({
  params,
}: {
  params: Promise<{ sura: string }>;
}) {
  const { sura } = await params;
  const suraNumber = parseInt(sura, 10);
  const suraData = suras.find((s) => s.number === suraNumber);
  if (!suraData) notFound();

  const prevSura = suraNumber > 1 ? suras[suraNumber - 2] : null;
  const nextSura = suraNumber < 114 ? suras[suraNumber] : null;

  return (
    <main className={`${styles.main} ornament-mihrab`}>
      <SuraHeader
        number={suraData.number}
        name={suraData.name}
        arabicName={suraData.arabicName}
        urduName={suraData.urduName}
        revelationType={suraData.revelationType}
        verseCount={suraData.verseCount}
      />
      <SuraReaderLoader
        key={suraNumber}
        suraNumber={suraNumber}
        suraName={suraData.name}
        prev={prevSura ? { href: `/quran/${prevSura.number}/`, name: prevSura.name } : null}
        next={nextSura ? { href: `/quran/${nextSura.number}/`, name: nextSura.name } : null}
      />
    </main>
  );
}
