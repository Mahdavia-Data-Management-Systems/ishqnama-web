import type { Metadata, Viewport } from "next";
import { EB_Garamond, Source_Sans_3, Noto_Serif, Noto_Serif_Devanagari } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/auth-provider";
import ReaderSettingsProvider from "@/context/reader-settings-context";
import AppBar from "@/components/navigation/app-bar";
import Footer from "@/components/navigation/footer";
import BottomNav from "@/components/navigation/bottom-nav";
import PwaInstallPrompt from "@/components/pwa-install-prompt";

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
  title: "Ishqnama",
  description: "Ishqnama — Quranic verses, translations and explanations",
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
      className={`${ebGaramond.variable} ${sourceSans.variable} ${notoSerif.variable} ${notoSerifDevanagari.variable}`}
    >
      <body>
        <AuthProvider>
          <ReaderSettingsProvider>
            <AppBar />
            {children}
            <Footer />
            <BottomNav />
            <PwaInstallPrompt />
          </ReaderSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
