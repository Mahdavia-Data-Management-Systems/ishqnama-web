import { notFound } from "next/navigation";
import { suras } from "@/data/suras";
import { RUKU_COUNTS_BY_SURA } from "@/data/rukus";
import SuraRukuReaderLoader from "./sura-ruku-reader-loader";

export function generateStaticParams() {
  const params: { sura: string; rankInChapter: string }[] = [];
  for (const [sura, count] of Object.entries(RUKU_COUNTS_BY_SURA)) {
    for (let rank = 1; rank <= count; rank++) {
      params.push({ sura, rankInChapter: String(rank) });
    }
  }
  return params;
}

export default async function SuraRukuPage({
  params,
}: {
  params: Promise<{ sura: string; rankInChapter: string }>;
}) {
  const { sura, rankInChapter: rankStr } = await params;
  const suraNumber = parseInt(sura, 10);
  const rank = parseInt(rankStr, 10);

  const suraData = suras.find((s) => s.number === suraNumber);
  if (!suraData) notFound();

  const maxRank = RUKU_COUNTS_BY_SURA[suraNumber];
  if (isNaN(rank) || rank < 1 || rank > maxRank) notFound();

  const prevRuku = rank > 1 ? rank - 1 : null;
  const nextRuku = rank < maxRank ? rank + 1 : null;

  return (
    <main className="ornament-mihrab" style={{ paddingBottom: "var(--toolbar-height)" }}>
      <SuraRukuReaderLoader
        key={`${suraNumber}-${rank}`}
        suraNumber={suraNumber}
        suraName={suraData.name}
        rank={rank}
        totalRukus={maxRank}
        prev={
          prevRuku !== null
            ? { href: `/quran/${suraNumber}/ruku/${prevRuku}/`, name: `Ruku ${prevRuku}` }
            : null
        }
        next={
          nextRuku !== null
            ? { href: `/quran/${suraNumber}/ruku/${nextRuku}/`, name: `Ruku ${nextRuku}` }
            : null
        }
      />
    </main>
  );
}
