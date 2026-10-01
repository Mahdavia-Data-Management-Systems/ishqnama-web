import type { MetadataRoute } from "next";
import { robotsFor } from "@/lib/robots";

// Required for metadata routes under `output: "export"`: written once to out/robots.txt.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return robotsFor();
}
