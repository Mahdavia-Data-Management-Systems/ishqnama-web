import { notFound } from "next/navigation";
import { RUKU_RANGES_BY_JUZ } from "@/data/rukus";
import JuzRukuReaderLoader from "./juz-ruku-reader-loader";

export function generateStaticParams() {
  const params: { juz: string; rankInJuz: string }[] = [];
  for (const [juz, { min, max }] of Object.entries(RUKU_RANGES_BY_JUZ)) {
    for (let rank = min; rank <= max; rank++) {
      params.push({ juz, rankInJuz: String(rank) });
    }
  }
  return params;
}

export default async function JuzRukuPage({
  params,
}: {
  params: Promise<{ juz: string; rankInJuz: string }>;
}) {
  const { juz, rankInJuz: rankStr } = await params;
  const juzNumber = parseInt(juz, 10);
  const rank = parseInt(rankStr, 10);

  const range = RUKU_RANGES_BY_JUZ[juzNumber];
  if (!range) notFound();
  if (isNaN(rank) || rank < range.min || rank > range.max) notFound();

  const prevRuku = rank > range.min ? rank - 1 : null;
  const nextRuku = rank < range.max ? rank + 1 : null;
  const totalRukus = range.max - range.min + 1;

  return (
    <main className="ornament-mihrab" style={{ paddingBottom: "var(--toolbar-height)" }}>
      <JuzRukuReaderLoader
        key={`${juzNumber}-${rank}`}
        juzNumber={juzNumber}
        rank={rank}
        totalRukus={totalRukus}
        prev={
          prevRuku !== null
            ? { href: `/quran/juz/${juzNumber}/ruku/${prevRuku}/`, name: `Ruku ${prevRuku}` }
            : null
        }
        next={
          nextRuku !== null
            ? { href: `/quran/juz/${juzNumber}/ruku/${nextRuku}/`, name: `Ruku ${nextRuku}` }
            : null
        }
      />
    </main>
  );
}
