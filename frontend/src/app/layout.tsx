import type { Metadata, Viewport } from "next";
import { EB_Garamond, Source_Sans_3, Noto_Serif, Noto_Serif_Devanagari } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/app-shell";
import { pwaManifestScript } from "@/lib/pwa-manifest";
import { pageMetadata, siteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/page-metadata";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-sans",
  display: "swap",
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-noto-serif",
  display: "swap",
});

const notoSerifDevanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "700"],
  variable: "--font-noto-serif-devanagari",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#004446",
};

export const metadata: Metadata = {
  // Resolves the relative og:url and og:image of every page to absolute URLs, which link
  // previews need. See src/lib/page-metadata.ts.
  metadataBase: siteUrl(),
  applicationName: SITE_NAME,
  // The home page's tags; every other page sets its own through pageMetadata().
  ...pageMetadata({ description: SITE_DESCRIPTION, path: "/" }),
  icons: { icon: "/logo-ishqnama.svg" },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${ebGaramond.variable} ${sourceSans.variable} ${notoSerif.variable} ${notoSerifDevanagari.variable}`}
    >
      <head>
        {/* Names the installed PWA after the environment host (e.g. "Ishqnama - Dev"). Must
            run before the browser reads the manifest, so it is inlined in the head rather
            than mounted as a component. See src/lib/pwa-manifest.ts. */}
        <script dangerouslySetInnerHTML={{ __html: pwaManifestScript() }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
