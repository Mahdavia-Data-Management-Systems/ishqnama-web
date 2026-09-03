import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    // Reduce parallelism for static page generation (1267 pages)
    // to avoid OOM in build workers
    cpus: 2,
  },
};

export default nextConfig;
