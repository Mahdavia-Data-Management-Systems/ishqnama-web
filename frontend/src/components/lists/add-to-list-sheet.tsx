"use client";

import { useEffect, useId, useLayoutEffect, useState, type CSSProperties } from "react";
import CreateListDialog from "@/components/lists/create-list-dialog";
import Sheet from "@/components/lists/sheet";
import Button from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { LISTS_COPY } from "@/config/lists-copy";
import { useLists } from "@/context/lists-context";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useArabicVerses } from "@/hooks/use-arabic-verses";
import { ApiError } from "@/lib/api-client";
import { localizeNumber } from "@/lib/translation-map";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";
import { useWheelToHorizontal } from "@/lib/use-wheel-to-horizontal";
import { LIST_LIMITS, groupReference, verseCountOf } from "@/lib/verse-lists";
import type { TranslationLang } from "@/components/scripture/ayah-block";
import type { ArabicVerseDto } from "@/types/lists";
import styles from "./add-to-list-sheet.module.css";

const ADDED_CLOSE_DELAY_MS = 1600;

interface AddToListSheetProps {
  chapter: number;
  verse: number;
  onClose: () => void;
}

/**
 * One line of the preview, scrolling sideways (by touch, or by dragging with a mouse) to show
 * the whole ayah. The first ayah opens on its beginning, with its number before it; the `tail`
 * (last) ayah opens on its ending, with its number after it.
 */
function PreviewLine({ verse, lang, tail }: { verse: ArabicVerseDto; lang: TranslationLang; tail?: boolean }) {
  const [scroller, setScroller] = useState<HTMLSpanElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  useDragToScroll(scroller);

  // The scroll box is LTR so the drag hook's scrollLeft maths holds: 0 shows the ayah's end
  // (its visual left) and the far end shows its beginning. Realigned once the font has loaded,
  // since the Arabic font changes the line's width.
  useLayoutEffect(() => {
    if (!scroller) return;
    const align = () => {
      scroller.scrollLeft = tail ? 0 : scroller.scrollWidth;
      setOverflows(scroller.scrollWidth > scroller.clientWidth);
    };
    align();
    let live = true;
    document.fonts?.ready.then(() => live && align());
    return () => {
      live = false;
    };
  }, [scroller, tail, verse.arabicText]);

  const number = <span className={styles.previewNumber}>{localizeNumber(verse.verseNumber, lang)}</span>;
  return (
    <div className={styles.previewLine} dir="rtl" lang="ar">
      {!tail && number}
      <span
        ref={setScroller}
        className={`${styles.previewScroll} ${tail ? styles.previewScrollTail : ""}`}
        data-overflow={overflows ? (tail ? "start" : "end") : undefined}
      >
        <bdi dir="rtl">{verse.arabicText}</bdi>
      </span>
      {tail && number}
    </div>
  );
}

/**
 * "Add to list" from a verse in the reader: the verse starts the group, the reader can stretch
 * it with the slider to a later ayah of the same sura (previewing the first and last ayah) and
 * give it a caption, then picks one of their lists (or starts a new one). The group is appended
 * on the server, so an editor open elsewhere keeps its work.
 */
export default function AddToListSheet({ chapter, verse, onClose }: AddToListSheetProps) {
  const { myLists, status, createList, addGroup } = useLists();
  const { lang } = useReaderSettings();
  const sliderId = useId();
  const verseCount = verseCountOf(chapter);
  const fromVerse = Math.max(1, verse);
  // One request for the rest of the sura, so the slider previews any ayah without waiting
  const { verses } = useArabicVerses(chapter, fromVerse, Math.max(fromVerse, verseCount));
  const [toVerse, setToVerse] = useState(fromVerse);
  const [caption, setCaption] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; done: boolean } | null>(null);
  const [rail, setRail] = useState<HTMLUListElement | null>(null);
  useWheelToHorizontal(rail);
  useDragToScroll(rail);

  // Preselect the list changed most recently, which is first
  useEffect(() => {
    if (listId == null && myLists.length > 0) setListId(myLists[0].id);
  }, [listId, myLists]);

  useEffect(() => {
    if (!message?.done) return;
    const t = setTimeout(onClose, ADDED_CLOSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [message, onClose]);

  const group = { chapter, fromVerse, toVerse };
  const canStretch = verseCount > fromVerse;
  const firstVerse = verses?.[0];
  const lastVerse = toVerse > fromVerse ? verses?.find((v) => v.verseNumber === toVerse) : undefined;
  // Where the thumb sits along the track, 0 to 1; the native thumb is placed by the same formula
  const position = canStretch ? (toVerse - fromVerse) / (verseCount - fromVerse) : 0;

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
        <div className={styles.preview}>
          {firstVerse ? (
            <>
              <PreviewLine verse={firstVerse} lang={lang} />
              {lastVerse ? (
                <PreviewLine verse={lastVerse} lang={lang} tail />
              ) : (
                canStretch && <p className={styles.previewHint}>{LISTS_COPY.stretchHint}</p>
              )}
            </>
          ) : (
            <span className={styles.previewPlaceholder} aria-hidden="true" />
          )}
        </div>

        {canStretch && (
          <div className={styles.field}>
            <label htmlFor={sliderId} className={styles.label}>
              {LISTS_COPY.toLabel}
            </label>
            <div className={styles.stepper}>
              <button
                type="button"
                className={`${styles.step} ${styles.stepDown}`}
                aria-label={LISTS_COPY.stepDown}
                aria-controls={sliderId}
                disabled={toVerse <= fromVerse}
                onClick={() => setToVerse((v) => Math.max(fromVerse, v - 1))}
              >
                <Icon name="minus" size={16} />
              </button>
              <div className={styles.sliderWrap} style={{ "--p": position } as CSSProperties}>
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.trackFill} />
                </span>
                <input
                  id={sliderId}
                  className={styles.slider}
                  type="range"
                  min={fromVerse}
                  max={verseCount}
                  step={1}
                  value={toVerse}
                  aria-valuetext={`${LISTS_COPY.ayahValue} ${toVerse}`}
                  onChange={(e) => setToVerse(Number(e.target.value))}
                />
                <span className={styles.thumb} aria-hidden="true">
                  <span className={styles.thumbGlyph}>&#1757;</span>
                  <span className={styles.thumbNumber}>{localizeNumber(toVerse, lang)}</span>
                </span>
              </div>
              <button
                type="button"
                className={`${styles.step} ${styles.stepUp}`}
                aria-label={LISTS_COPY.stepUp}
                aria-controls={sliderId}
                disabled={toVerse >= verseCount}
                onClick={() => setToVerse((v) => Math.min(verseCount, v + 1))}
              >
                <Icon name="plus" size={16} />
              </button>
              <div className={styles.sliderEnds} aria-hidden="true">
                <span>{localizeNumber(fromVerse, lang)}</span>
                <span>{localizeNumber(verseCount, lang)}</span>
              </div>
            </div>
          </div>
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
          <ul ref={setRail} className={styles.options}>
            <li className={styles.newItem}>
              <button type="button" className={`${styles.option} ${styles.optionNew}`} onClick={() => setCreating(true)}>
                <Icon name="plus" size={20} />
                <span className={styles.optionNewLabel}>{LISTS_COPY.newList}</span>
              </button>
            </li>
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
            disabled={!chosen || busy || message?.done}
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
          void add(list.id, list.title);
        }}
      />
    </>
  );
}
