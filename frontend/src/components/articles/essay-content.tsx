"use client";

import EssayBody from "@/components/articles/essay-body";
import {
  ESSAY_FAILED_MESSAGE,
  ESSAY_LOADING_MESSAGE,
  TRY_AGAIN_LABEL,
  UNREACHABLE_MESSAGE,
  WARMING_MESSAGE,
} from "@/config/readiness-copy";
import { useEssay } from "@/hooks/use-essay";
import { useApiReadiness } from "@/lib/api-readiness";
import styles from "./essay-content.module.css";

/** Fetches and shows one essay, with the reader's cold-start placeholder while it waits. */
export default function EssayContent({ slug }: { slug: string }) {
  const { essay, failed, retry } = useEssay(slug);
  const readiness = useApiReadiness();

  if (essay) return <EssayBody blocks={essay.blocks} />;

  // While warming or unreachable the hook retries on its own once the API is ready
  if (readiness === "warming" || readiness === "unreachable" || !failed) {
    const message =
      readiness === "warming" ? WARMING_MESSAGE : readiness === "unreachable" ? UNREACHABLE_MESSAGE : ESSAY_LOADING_MESSAGE;
    return (
      <div className={styles.placeholder}>
        <div className={styles.spinner} />
        <p className={styles.placeholderText}>{message}</p>
      </div>
    );
  }

  return (
    <div className={styles.placeholder}>
      <p className={styles.placeholderText}>{ESSAY_FAILED_MESSAGE}</p>
      <button type="button" className={styles.retryButton} onClick={retry}>
        {TRY_AGAIN_LABEL}
      </button>
    </div>
  );
}
