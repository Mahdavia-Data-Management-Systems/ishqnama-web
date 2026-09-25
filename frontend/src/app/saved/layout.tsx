import SavedGate from "@/components/saved-gate";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Saved",
  description: "Your bookmarks and reading history on Ishqnama.",
  path: "/saved/",
});

export default function SavedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SavedGate>{children}</SavedGate>;
}
