"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { LISTS_COPY } from "@/config/lists-copy";
import { CREATE_BOOKMARK_HELPER } from "@/config/readiness-copy";
import { useApiReadiness } from "@/lib/api-readiness";
import { LIST_LIMITS } from "@/lib/verse-lists";
import type { VerseListDto } from "@/types/lists";
import { lockPageScroll } from "@/lib/page-scroll-lock";
import styles from "@/components/create-bookmark-dialog.module.css";

interface CreateListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string | null) => Promise<VerseListDto>;
  /** Called with the new list once the server has it. */
  onCreated?: (list: VerseListDto) => void;
}

/** Names a new list; groups are added afterwards in the editor or from the reader. */
export default function CreateListDialog({ isOpen, onClose, onCreate, onCreated }: CreateListDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const readiness = useApiReadiness();
  const waiting = readiness === "warming" || readiness === "unreachable";

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setError("");
    setSaving(false);
    const unlockScroll = lockPageScroll();
    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const canCreate = title.trim().length > 0 && !saving;

  const handleCreate = async () => {
    if (!canCreate) return;
    setError("");
    setSaving(true);
    try {
      const created = await onCreate(title.trim(), description.trim() || null);
      onClose();
      onCreated?.(created);
    } catch (err) {
      setError(
        (err as { name?: string } | null)?.name === "AbortError"
          ? LISTS_COPY.createTimeout
          : LISTS_COPY.createFailed,
      );
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-list-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="create-list-heading" className={styles.heading}>{LISTS_COPY.newList}</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="list-title">{LISTS_COPY.titleLabel}</label>
            <input
              id="list-title"
              type="text"
              className={`${styles.input} ${error ? styles.inputError : ""}`}
              placeholder={LISTS_COPY.titlePlaceholder}
              maxLength={LIST_LIMITS.title}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              autoFocus
            />
            {error && <p className={styles.errorText}>{error}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="list-description">{LISTS_COPY.descriptionLabel}</label>
            <textarea
              id="list-description"
              className={styles.input}
              placeholder={LISTS_COPY.descriptionPlaceholder}
              maxLength={LIST_LIMITS.description}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {waiting && <p className={styles.helper}>{CREATE_BOOKMARK_HELPER}</p>}

        <div className={styles.footer}>
          <button className={styles.createBtn} disabled={!canCreate} onClick={handleCreate}>
            {saving ? LISTS_COPY.creating : LISTS_COPY.create}
          </button>
        </div>
      </div>
    </div>
  );
}
