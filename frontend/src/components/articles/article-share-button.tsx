"use client";

import { useState } from "react";
import IconButton from "@/components/ui/icon-button";
import { shareVerse } from "@/lib/share-verse";
import { trackEvent } from "@/lib/telemetry";
import styles from "./article-share-button.module.css";

const SHARE_LABEL = "Share";
const COPIED_NOTE = "Link copied. Paste it wherever you like.";
const FAILED_NOTE = "Couldn't share from here. Try again.";

interface ArticleShareButtonProps {
  /** The page's own path, e.g. "/articles/nooreimaan/naskh/". */
  path: string;
  title: string;
  /** The message the link travels with; the essay text itself is never shared. */
  text: string;
  /** Which kind of page, for telemetry only. */
  page: "index" | "essay";
}

/** Shares an articles page's link through the system share sheet, or copies it. */
export default function ArticleShareButton({ path, title, text, page }: ArticleShareButtonProps) {
  const [note, setNote] = useState<string | null>(null);

  const handleShare = async () => {
    setNote(null);
    const result = await shareVerse({ title, text, url: `${window.location.origin}${path}` });
    if (result === "shared" || result === "copied") {
      trackEvent("article-shared", { option: page, method: result === "shared" ? "native" : "clipboard" });
    }
    if (result === "copied") setNote(COPIED_NOTE);
    if (result === "failed") setNote(FAILED_NOTE);
  };

  return (
    <div className={styles.share}>
      <IconButton icon="share" label={SHARE_LABEL} size="sm" onClick={() => void handleShare()} />
      {note && (
        <p className={styles.note} role="status">
          {note}
        </p>
      )}
    </div>
  );
}
