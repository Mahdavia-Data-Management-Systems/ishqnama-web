import { pageMetadata } from "@/lib/page-metadata";

// For /quran/ itself. The chapter, juz and ruku pages below override it with their own.
export const metadata = pageMetadata({
  title: "The Holy Quran",
  description:
    "Browse all 114 chapters and 30 ajza of the Holy Quran, with Urdu, Hindi and English tarjuma and the Noor e Imaan tafseer.",
  path: "/quran/",
});

export default function QuranLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
