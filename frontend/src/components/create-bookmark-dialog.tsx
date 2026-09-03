"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { bookmarkIcons } from "@/config/bookmark-icons";
import { ApiError } from "@/lib/api-client";
import styles from "./create-bookmark-dialog.module.css";

interface CreateBookmarkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, icon: string) => Promise<unknown>;
}

export default function CreateBookmarkDialog({ isOpen, onClose, onCreate }: CreateBookmarkDialogProps) {
  const [title, setTitle] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setSelectedIcon("");
      setError("");
      setSaving(false);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canCreate = title.trim().length > 0 && selectedIcon.length > 0 && !saving;

  const handleCreate = async () => {
    if (!canCreate) return;
    setError("");
    setSaving(true);
    try {
      await onCreate(title.trim(), selectedIcon);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("A bookmark with this name already exists.");
      } else {
        setError("Failed to create bookmark. Please try again.");
      }
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.heading}>New bookmark</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="bookmark-title">Title</label>
            <input
              id="bookmark-title"
              type="text"
              className={`${styles.input} ${error ? styles.inputError : ""}`}
              placeholder="e.g. Eesal e Sawab, Daily Session"
              maxLength={50}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              autoFocus
            />
            {error && <p className={styles.errorText}>{error}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Icon</label>
            <div className={styles.iconGrid}>
              {bookmarkIcons.map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.iconOption} ${selectedIcon === key ? styles.iconSelected : ""}`}
                  onClick={() => setSelectedIcon(key)}
                  aria-label={label}
                  title={label}
                >
                  <Icon name={key} size={20} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.createBtn} disabled={!canCreate} onClick={handleCreate}>
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
