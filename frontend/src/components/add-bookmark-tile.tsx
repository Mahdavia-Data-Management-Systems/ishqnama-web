"use client";

import Icon from "@/components/ui/icon";
import styles from "./add-bookmark-tile.module.css";

interface AddBookmarkTileProps {
  onClick: () => void;
}

export default function AddBookmarkTile({ onClick }: AddBookmarkTileProps) {
  return (
    <button className={styles.tile} onClick={onClick}>
      <span className={styles.iconWrap}>
        <Icon name="plus" size={24} />
      </span>
      <span className={styles.label}>New bookmark</span>
    </button>
  );
}
