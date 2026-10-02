"use client";

import Link from "next/link";
import OwnerAvatar from "@/components/lists/owner-avatar";
import Icon from "@/components/ui/icon";
import { LISTS_COPY } from "@/config/lists-copy";
import { listEditPath, listViewPath } from "@/lib/verse-lists";
import type { VerseListSummaryDto } from "@/types/lists";
import styles from "./list-row.module.css";

interface ListRowProps {
  list: VerseListSummaryDto;
  /** My own list: shows its Draft/Published badge and an Edit link, and opens the editor while a draft. */
  mine?: boolean;
}

/** One list on the Library page: title, description and, for other readers' lists, who compiled it. */
export default function ListRow({ list, mine = false }: ListRowProps) {
  const owner = list.ownerName || LISTS_COPY.aReader;
  // A draft has no public page yet, so the row goes straight to the editor
  const href = mine && list.status === "draft" ? listEditPath(list.id) : listViewPath(list.id);

  return (
    <div className={styles.row}>
      <Link href={href} className={styles.main}>
        <span className={styles.titleLine}>
          <span className={styles.title}>{list.title}</span>
          {mine && (
            <span className={`${styles.badge} ${list.status === "published" ? styles.badgePublished : ""}`}>
              {list.status === "published" ? LISTS_COPY.published : LISTS_COPY.draft}
            </span>
          )}
        </span>
        {list.description && <span className={styles.description}>{list.description}</span>}
        {/* My own lists all carry my name, so only other readers' lists show who compiled them */}
        {!mine && (
          <span className={styles.owner}>
            <OwnerAvatar name={owner} />
            <span>{owner}</span>
          </span>
        )}
      </Link>
      {mine && (
        <Link
          href={listEditPath(list.id)}
          className={`${styles.edit} ${styles.editIcon}`}
          aria-label={LISTS_COPY.edit}
          title={LISTS_COPY.edit}
        >
          <Icon name="pencil" size={18} />
        </Link>
      )}
    </div>
  );
}

/** A favourite whose list was unpublished or deleted: its saved title and a way to remove it. */
export function UnavailableListRow({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <div className={`${styles.row} ${styles.unavailable}`}>
      <div className={styles.main}>
        <span className={styles.title}>{title}</span>
        <span className={styles.description}>{LISTS_COPY.noLongerAvailable}</span>
      </div>
      <button type="button" className={styles.edit} onClick={onRemove}>
        {LISTS_COPY.remove}
      </button>
    </div>
  );
}
