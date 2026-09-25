import { pageMetadata } from "@/lib/page-metadata";

// The search page is a client component and cannot export metadata itself.
export const metadata = pageMetadata({
  title: "Search",
  description: "Search the tarjuma and tafseer of the Holy Quran on Ishqnama.",
  path: "/search/",
});

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
