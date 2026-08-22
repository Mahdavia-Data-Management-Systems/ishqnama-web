import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/auth-provider";
import AppBar from "@/components/navigation/app-bar";

export const metadata: Metadata = {
  title: "Ishqnama",
  description: "Ishqnama — Quranic verses, translations and explanations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
