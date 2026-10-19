"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ReflectionPlayer {
  /** The `url` of the reflection whose discussion is open, or null. */
  openUrl: string | null;
  setOpenUrl: (url: string | null) => void;
}

const ReflectionPlayerContext = createContext<ReflectionPlayer | null>(null);

/**
 * Which of a list's recordings is open in the hosts' bubble: one at a time, since the bubble
 * docks in the corner and owns its own audio, so opening another closes the first.
 */
export function ReflectionPlayerProvider({ children }: { children: ReactNode }) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  return <ReflectionPlayerContext.Provider value={{ openUrl, setOpenUrl }}>{children}</ReflectionPlayerContext.Provider>;
}

/** The shared open recording, or a card's own when it is rendered outside a list. */
export function useReflectionPlayer(): ReflectionPlayer {
  const shared = useContext(ReflectionPlayerContext);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  return shared ?? { openUrl, setOpenUrl };
}
