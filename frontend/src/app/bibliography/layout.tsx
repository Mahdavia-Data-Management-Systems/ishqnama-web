import { pageMetadata } from "@/lib/page-metadata";

// The bibliography page is a client component and cannot export metadata itself.
export const metadata = pageMetadata({
  title: "Bibliography",
  description:
    "The books cited in the takhreej of Noor e Imaan on Ishqnama, and how often each is cited.",
  path: "/bibliography/",
});

export default function BibliographyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
