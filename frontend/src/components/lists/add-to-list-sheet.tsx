"use client";

import { useEffect, useState } from "react";
import CreateListDialog from "@/components/lists/create-list-dialog";
import Sheet from "@/components/lists/sheet";
import Button from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { LISTS_COPY } from "@/config/lists-copy";
import { useLists } from "@/context/lists-context";
import { ApiError } from "@/lib/api-client";
import { LIST_LIMITS, groupReference, verseCountOf } from "@/lib/verse-lists";
import styles from "./add-to-list-sheet.module.css";

const ADDED_CLOSE_DELAY_MS = 1600;

interface AddToListSheetProps {
  chapter: number;
  verse: number;
  onClose: () => void;
}

/**
 * "Add to list" from a verse in the reader: the verse starts the group, the reader can stretch
 * it to a later ayah of the same sura and give it a caption, then picks one of their lists (or
 * starts a new one). The group is appended on the server, so an editor open elsewhere keeps its work.
 */
export default function AddToListSheet({ chapter, verse, onClose }: AddToListSheetProps) {
  const { myLists, status, createList, addGroup } = useLists();
  const verseCount = verseCountOf(chapter);
  const fromVerse = Math.max(1, verse);
  const [toVerse, setToVerse] = useState(fromVerse);
  const [caption, setCaption] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; done: boolean } | null>(null);

  // Preselect the list changed most recently, which is first
  useEffect(() => {
    if (listId == null && myLists.length > 0) setListId(myLists[0].id);
  }, [listId, myLists]);

  useEffect(() => {
    if (!message?.done) return;
    const t = setTimeout(onClose, ADDED_CLOSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [message, onClose]);

  const rangeValid = toVerse >= fromVerse && toVerse <= verseCount;
  const group = { chapter, fromVerse, toVerse: rangeValid ? toVerse : fromVerse };

  const add = async (targetId: string, title: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await addGroup(targetId, { ...group, caption: caption.trim() || null });
      setMessage({ text: `${LISTS_COPY.addedTo} ${title}`, done: true });
    } catch (err) {
      setMessage({
        text: err instanceof ApiError && err.status === 409 ? LISTS_COPY.listFull : LISTS_COPY.addFailed,
        done: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const chosen = myLists.find((l) => l.id === listId);

  return (
    <>
      <Sheet title={LISTS_COPY.addToListHeading} subtitle={groupReference(group)} onClose={onClose}>
        <div className={styles.range}>
          <label className={styles.field}>
            <span className={styles.label}>{LISTS_COPY.fromLabel}</span>
            <input className={styles.input} value={fromVerse} readOnly aria-readonly="true" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{LISTS_COPY.toLabel}</span>
            <input
              className={`${styles.input} ${rangeValid ? "" : styles.invalid}`}
              type="number"
              inputMode="numeric"
              min={fromVerse}
              max={verseCount}
              value={toVerse || ""}
              onChange={(e) => setToVerse(parseInt(e.target.value, 10) || 0)}
            />
          </label>
        </div>
        {!rangeValid && (
          <p className={styles.error}>
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
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>

        <fieldset className={styles.lists}>
          <legend className={styles.label}>{LISTS_COPY.chooseList}</legend>
          {status === "loading" && myLists.length === 0 && <p className={styles.hint}>{LISTS_COPY.listsWarming}</p>}
          <ul className={styles.options}>
            {myLists.map((l) => (
              <li key={l.id}>
                <label className={`${styles.option} ${listId === l.id ? styles.optionChosen : ""}`}>
                  <input
                    type="radio"
                    name="add-to-list"
                    className={styles.radio}
                    checked={listId === l.id}
                    onChange={() => setListId(l.id)}
                  />
                  <span className={styles.optionTitle}>{l.title}</span>
                  <span className={styles.optionMeta}>
                    {l.status === "published" ? LISTS_COPY.published : LISTS_COPY.draft}
                  </span>
                </label>
              </li>
            ))}
            <li>
              <button type="button" className={styles.option} onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} />
                <span className={styles.optionTitle}>{LISTS_COPY.newList}</span>
              </button>
            </li>
          </ul>
        </fieldset>

        {message && (
          <p className={`${styles.message} ${message.done ? styles.messageDone : ""}`} role="status">
            {message.done && <Icon name="check" size={16} />}
            {message.text}
          </p>
        )}

        <div className={styles.footer}>
          <Button
            fullWidth
            disabled={!chosen || !rangeValid || busy || message?.done}
            onClick={() => chosen && void add(chosen.id, chosen.title)}
          >
            {busy ? LISTS_COPY.adding : LISTS_COPY.addToList}
          </Button>
        </div>
      </Sheet>

      <CreateListDialog
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreate={createList}
        onCreated={(list) => {
          setListId(list.id);
          if (rangeValid) void add(list.id, list.title);
        }}
      />
    </>
  );
}
