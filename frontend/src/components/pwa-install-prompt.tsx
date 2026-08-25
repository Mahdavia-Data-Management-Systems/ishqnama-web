"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "./ui/button";
import styles from "./pwa-install-prompt.module.css";

const DISMISSED_KEY = "pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "dismissed") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    setDeferredPrompt(null);
    setShow(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferredPrompt(null);
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className={styles.backdrop} onClick={handleDismiss}>
      <div className={styles.prompt} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ishqnama.svg"
            alt="Ishqnama"
            className={styles.icon}
          />
          <span className={styles.title}>Install Ishqnama</span>
        </div>
        <p className={styles.description}>
          Install the app for a faster, full-screen experience with easy access
          from your home screen.
        </p>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Not now
          </Button>
          <Button variant="primary" size="sm" onClick={handleInstall}>
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}
