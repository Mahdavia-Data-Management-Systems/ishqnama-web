"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthProvider from "@/components/auth-provider";
import AudioPlayerProvider from "@/context/audio-player-context";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import ReaderSettingsProvider from "@/context/reader-settings-context";
import BookmarksProvider from "@/context/bookmarks-context";
import ListsProvider from "@/context/lists-context";
import AppBar from "@/components/navigation/app-bar";
import Footer from "@/components/navigation/footer";
import BottomNav from "@/components/navigation/bottom-nav";
import PwaInstallPrompt from "@/components/pwa-install-prompt";
import ApiKeepAlive from "@/components/api-keep-alive";
import GlobalLoadingIndicator from "@/components/global-loading-indicator";
import ApiWarmupNotice from "@/components/api-warmup-notice";
import Telemetry from "@/components/telemetry";
import { isAuthRedirectPath } from "@/lib/auth-redirect";

/**
 * Everything inside <body>. The MSAL redirect bridge route is rendered bare:
 * no MSAL initialisation, no telemetry, keep-alive ping or warm-up notice, no app chrome, so the hidden
 * iframe MSAL opens for silent token renewal loads only the bridge script.
 * See src/lib/auth-redirect.ts.
 *
 * The audio player sits inside the reader settings (it follows the continue setting and its bar
 * opens the sheet) but around every page, so a recording outlives navigation: the bar and the
 * playing verse survive it. It asks for no account, so it plays for every reader.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isAuthRedirectPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Telemetry />
      <ApiKeepAlive />
      <GlobalLoadingIndicator />
      <ApiWarmupNotice />
      <AuthProvider>
        <SignInPromptProvider>
          <ReaderSettingsProvider>
            <AudioPlayerProvider>
              <BookmarksProvider>
                <ListsProvider>
                  <AppBar />
                  {children}
                  <Footer />
                  <BottomNav />
                  <PwaInstallPrompt />
                </ListsProvider>
              </BookmarksProvider>
            </AudioPlayerProvider>
          </ReaderSettingsProvider>
        </SignInPromptProvider>
      </AuthProvider>
    </>
  );
}
