"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthProvider from "@/components/auth-provider";
import ReaderSettingsProvider from "@/context/reader-settings-context";
import BookmarksProvider from "@/context/bookmarks-context";
import AppBar from "@/components/navigation/app-bar";
import Footer from "@/components/navigation/footer";
import BottomNav from "@/components/navigation/bottom-nav";
import PwaInstallPrompt from "@/components/pwa-install-prompt";
import ApiKeepAlive from "@/components/api-keep-alive";
import GlobalLoadingIndicator from "@/components/global-loading-indicator";
import ApiWarmupNotice from "@/components/api-warmup-notice";
import { isAuthRedirectPath } from "@/lib/auth-redirect";

/**
 * Everything inside <body>. The MSAL redirect bridge route is rendered bare:
 * no MSAL initialisation, no keep-alive ping or warm-up notice, no app chrome, so the hidden
 * iframe MSAL opens for silent token renewal loads only the bridge script.
 * See src/lib/auth-redirect.ts.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isAuthRedirectPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <ApiKeepAlive />
      <GlobalLoadingIndicator />
      <ApiWarmupNotice />
      <AuthProvider>
        <ReaderSettingsProvider>
          <BookmarksProvider>
            <AppBar />
            {children}
            <Footer />
            <BottomNav />
            <PwaInstallPrompt />
          </BookmarksProvider>
        </ReaderSettingsProvider>
      </AuthProvider>
    </>
  );
}
