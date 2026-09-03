"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import IconButton from "@/components/ui/icon-button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { suras } from "@/data/suras";
import type { UserBookmarkDto } from "@/types/user";
import styles from "./bookmark-tile.module.css";

interface BookmarkTileProps {
  bookmark: UserBookmarkDto;
  onDelete?: (slug: string) => void;
}

function getPositionLabel(chapterNumber: number, verseNumber: number): string {
  if (verseNumber === 0) return "Not started";
  const sura = suras.find((s) => s.number === chapterNumber);
  const name = sura?.name ?? `Sura ${chapterNumber}`;
  return `${name} — ${chapterNumber}:${verseNumber}`;
}

export default function BookmarkTile({ bookmark, onDelete }: BookmarkTileProps) {
  const { slug, title, icon, chapterNumber, verseNumber, isDefault } = bookmark;
  const href = verseNumber > 0 ? `/quran/${chapterNumber}/?verse=${verseNumber}` : `/quran/${chapterNumber}/`;
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className={styles.tile}>
      <Link href={href} className={styles.link}>
        <span className={styles.iconWrap}>
          <Icon name={icon} size={22} />
        </span>
        <span className={styles.title}>{title}</span>
        <span className={styles.position}>{getPositionLabel(chapterNumber, verseNumber)}</span>
      </Link>
      {!isDefault && onDelete && (
        <>
          <IconButton
            icon="trash"
            label={`Delete ${title}`}
            size="sm"
            className={styles.deleteBtn}
            onClick={() => setConfirmOpen(true)}
          />
          <ConfirmDialog
            isOpen={confirmOpen}
            title="Delete bookmark"
            message={`Are you sure you want to delete "${title}"? This cannot be undone.`}
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => { setConfirmOpen(false); onDelete(slug); }}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      )}
    </div>
  );
}
