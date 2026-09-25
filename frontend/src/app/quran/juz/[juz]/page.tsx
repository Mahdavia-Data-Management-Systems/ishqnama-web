import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JuzReaderLoader from "./juz-reader-loader";
import { juzMetadata } from "@/lib/page-metadata";

export function generateStaticParams() {
  return Array.from({ length: 30 }, (_, i) => ({
    juz: String(i + 1),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ juz: string }>;
}): Promise<Metadata> {
  const { juz } = await params;
  return juzMetadata(parseInt(juz, 10));
}

export default async function JuzReaderPage({
  params,
}: {
  params: Promise<{ juz: string }>;
}) {
  const { juz } = await params;
  const juzNumber = parseInt(juz, 10);
  if (isNaN(juzNumber) || juzNumber < 1 || juzNumber > 30) notFound();

  const prevJuz = juzNumber > 1 ? juzNumber - 1 : null;
  const nextJuz = juzNumber < 30 ? juzNumber + 1 : null;

  return (
    <main className="ornament-mihrab" style={{ paddingBottom: "var(--toolbar-height)" }}>
      <JuzReaderLoader
        key={juzNumber}
        juzNumber={juzNumber}
        prev={prevJuz ? { href: `/quran/juz/${prevJuz}/`, name: `Juz ${prevJuz}` } : null}
        next={nextJuz ? { href: `/quran/juz/${nextJuz}/`, name: `Juz ${nextJuz}` } : null}
      />
    </main>
  );
}
