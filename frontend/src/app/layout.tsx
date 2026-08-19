import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/auth-provider";
import AuthButton from "@/components/auth-button";

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
      <body>
        <AuthProvider>
          <header>
            <AuthButton />
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
