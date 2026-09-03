"use client";

import { useEffect } from "react";
import Icon from "@/components/ui/icon";
import { suras } from "@/data/suras";
import type { UserBookmarkDto } from "@/types/user";
import styles from "./bookmark-picker.module.css";

interface BookmarkPickerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: UserBookmarkDto[];
  onSelect: (slug: string) => void;
}

function getPositionLabel(chapterNumber: number, verseNumber: number): string {
  if (verseNumber === 0) return "Not started";
  const sura = suras.find((s) => s.number === chapterNumber);
  const name = sura?.name ?? `Sura ${chapterNumber}`;
  return `${name} ${chapterNumber}:${verseNumber}`;
}

export default function BookmarkPicker({ isOpen, onClose, bookmarks, onSelect }: BookmarkPickerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.heading}>Save to bookmark</h3>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <ul className={styles.list}>
          {bookmarks.map((b) => (
            <li key={b.slug}>
              <button
                className={styles.item}
                onClick={() => {
                  onSelect(b.slug);
                  onClose();
                }}
              >
                <span className={styles.itemIcon}>
                  <Icon name={b.icon} size={18} />
                </span>
                <span className={styles.itemBody}>
                  <span className={styles.itemTitle}>{b.title}</span>
                  <span className={styles.itemPosition}>{getPositionLabel(b.chapterNumber, b.verseNumber)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
