import LibraryGate from "@/components/library-gate";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Library",
  description: "Your bookmarks, lists and reading history on Ishqnama.",
  path: "/library/",
});

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LibraryGate>{children}</LibraryGate>;
}
