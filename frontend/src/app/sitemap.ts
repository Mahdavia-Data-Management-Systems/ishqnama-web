import type { MetadataRoute } from "next";
import { sitemapFor } from "@/lib/sitemap";

// Required for metadata routes under `output: "export"`: written once to out/sitemap.xml.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor();
}
