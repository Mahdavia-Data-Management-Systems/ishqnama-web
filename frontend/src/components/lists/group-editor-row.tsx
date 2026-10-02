"use client";

import { useId } from "react";
import IconButton from "@/components/ui/icon-button";
import { LISTS_COPY } from "@/config/lists-copy";
import { suras } from "@/data/suras";
import { LIST_LIMITS, isValidGroup, verseCountOf } from "@/lib/verse-lists";
import type { VerseListGroupDto } from "@/types/lists";
import styles from "./group-editor-row.module.css";

export interface EditorGroup extends VerseListGroupDto {
  /** Stable React key; the server id is null until the group is first saved. */
  key: string;
}

interface GroupEditorRowProps {
  group: EditorGroup;
  index: number;
  count: number;
  onChange: (group: EditorGroup) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

function toNumber(value: string): number {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** One group in the list editor: sura, from and to ayah within it, and a caption. */
export default function GroupEditorRow({ group, index, count, onChange, onMove, onRemove }: GroupEditorRowProps) {
  const id = useId();
  const verseCount = verseCountOf(group.chapter);
  const valid = isValidGroup(group);

  const setChapter = (chapter: number) => onChange({ ...group, chapter, fromVerse: 1, toVerse: 1 });

  const setFrom = (fromVerse: number) =>
    // Moving "from" past "to" carries "to" along, so the range stays a range
    onChange({ ...group, fromVerse, toVerse: Math.max(group.toVerse, fromVerse) });

  return (
    <li className={styles.row}>
      <div className={styles.top}>
        <span className={styles.index} aria-hidden="true">{index + 1}</span>
        <div className={styles.tools}>
          {/* A move that cannot happen keeps its place but is hidden, so the tools never shift */}
          <IconButton
            icon="chevronDown"
            label={LISTS_COPY.moveUp}
            size="sm"
            className={`${styles.up} ${index === 0 ? styles.unavailable : ""}`}
            onClick={() => index > 0 && onMove(-1)}
          />
          <IconButton
            icon="chevronDown"
            label={LISTS_COPY.moveDown}
            size="sm"
            className={index === count - 1 ? styles.unavailable : ""}
            onClick={() => index < count - 1 && onMove(1)}
          />
          <IconButton icon="trash" label={LISTS_COPY.removeGroup} size="sm" onClick={onRemove} />
        </div>
      </div>

      <div className={styles.fields}>
        <label className={`${styles.field} ${styles.chapterField}`}>
          <span className={styles.label}>{LISTS_COPY.chapterLabel}</span>
          <select
            className={styles.input}
            value={group.chapter}
            onChange={(e) => setChapter(toNumber(e.target.value))}
          >
            {suras.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{LISTS_COPY.fromLabel}</span>
          <input
            className={`${styles.input} ${valid ? "" : styles.invalid}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={verseCount}
            value={group.fromVerse || ""}
            onChange={(e) => setFrom(toNumber(e.target.value))}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{LISTS_COPY.toLabel}</span>
          <input
            className={`${styles.input} ${valid ? "" : styles.invalid}`}
            type="number"
            inputMode="numeric"
            min={group.fromVerse || 1}
            max={verseCount}
            value={group.toVerse || ""}
            onChange={(e) => onChange({ ...group, toVerse: toNumber(e.target.value) })}
          />
        </label>
      </div>
      {!valid && (
        <p className={styles.error} id={`${id}-error`}>
          {LISTS_COPY.groupInvalid} {verseCount}.
        </p>
      )}

      <label className={styles.field}>
        <span className={styles.label}>{LISTS_COPY.captionLabel}</span>
        <input
          className={styles.input}
          type="text"
          maxLength={LIST_LIMITS.caption}
          placeholder={LISTS_COPY.captionPlaceholder}
          value={group.caption ?? ""}
          onChange={(e) => onChange({ ...group, caption: e.target.value })}
        />
      </label>
    </li>
  );
}
