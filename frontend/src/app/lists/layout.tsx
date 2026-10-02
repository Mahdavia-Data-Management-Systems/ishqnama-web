import { pageMetadata } from "@/lib/page-metadata";

// The list pages are client components that read the list id from ?id=, so a list's own title
// cannot be known at build time; every list link shares this preview.
export const metadata = pageMetadata({
  title: "A list of ayaat",
  description: "Ayaat of Noor e Imaan gathered by a reader on Ishqnama.",
  path: "/lists/view/",
});

export default function ListsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
