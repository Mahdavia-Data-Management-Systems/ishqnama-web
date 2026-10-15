import { pageMetadata } from "@/lib/page-metadata";

// The lab page is a client component and cannot export metadata itself. It is disallowed in
// robots.txt and absent from the sitemap: features are tried here before they have a home.
export const metadata = pageMetadata({
  title: "Discussion",
  description: "Hamza and Zoya discuss a passage of Noor e Imaan.",
  path: "/lab/podcast/",
});

export default function PodcastLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
