"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import ReaderToolbar from "@/components/reader-toolbar";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import { useReaderSettings } from "@/context/reader-settings-context";

type EssayLink = { href: string; name: string } | null;

interface EssayReaderProps {
  children: ReactNode;
  /** The neighbouring essays in book order, for the toolbar's arrows. */
  prev: EssayLink;
  next: EssayLink;
}

/**
 * The essay text above the reader's bottom toolbar, which carries the previous and next essays,
 * the font stepper and settings, without the Quran reader's mode and language controls. As in
 * the Quran reader, the size starts from the reader's saved setting and a change lasts the visit.
 */
export default function EssayReader({ children, prev, next }: EssayReaderProps) {
  const { fontScale: savedFontScale } = useReaderSettings();
  const [fontScale, setFontScale] = useState(savedFontScale);
  useEffect(() => setFontScale(savedFontScale), [savedFontScale]);

  const scale = (FONT_SIZE_STEPS[fontScale] ?? 100) / 100;

  return (
    <>
      <div style={{ "--essay-scale": scale } as CSSProperties}>{children}</div>
      <ReaderToolbar
        prev={prev}
        next={next}
        rtl
        showSettings={true}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
      />
    </>
  );
}
