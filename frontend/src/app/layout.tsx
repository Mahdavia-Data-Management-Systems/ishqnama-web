import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ishqnama",
  description: "Ishqnama — Mahdavia Data Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
