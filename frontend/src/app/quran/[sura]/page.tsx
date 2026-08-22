import SuraReaderClient from "./sura-reader-client";

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

  return <SuraReaderClient suraNumber={suraNumber} />;
}
