"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLoading from "@/components/auth-loading";
import EmptyState from "@/components/empty-state";
import GroupEditorRow, { type EditorGroup } from "@/components/lists/group-editor-row";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { LISTS_COPY } from "@/config/lists-copy";
import { useLists } from "@/context/lists-context";
import { ApiError } from "@/lib/api-client";
import { onReady } from "@/lib/api-readiness";
import {
  deleteList,
  getMyList,
  replaceListGroups,
  setListPublished,
  updateListDetails,
} from "@/lib/lists-api";
import { shareList } from "@/lib/share-list";
import { trackEvent } from "@/lib/telemetry";
import { LIST_LIMITS, isValidGroup, listViewPath } from "@/lib/verse-lists";
import type { VerseListDto, VerseListGroupDto } from "@/types/lists";
import styles from "./list-editor.module.css";

/** Pause after the last keystroke before saving, as the reader settings do. */
const SAVE_DELAY_MS = 800;

type SaveState = "idle" | "saving" | "saved" | "failed";

let nextKey = 0;
function keyed(groups: VerseListGroupDto[]): EditorGroup[] {
  return groups.map((g) => ({ ...g, key: g.id ?? `new-${nextKey++}` }));
}

function toDto({ id, chapter, fromVerse, toVerse, caption }: EditorGroup): VerseListGroupDto {
  return { id, chapter, fromVerse, toVerse, caption: caption?.trim() || null };
}

/**
 * The owner's editor. Every change saves itself after a short pause: the title and description
 * with one call, the groups (adds, removals, reordering, captions) with another that replaces
 * them all. Saves run one at a time; a failed save is retried when the site is reachable again.
 * Coming back to the tab reloads the list unless an edit is still waiting to be saved, so groups
 * added from the reader in another tab appear.
 */
export default function ListEditor() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { noteListChanged, noteListDeleted } = useLists();

  const [list, setList] = useState<VerseListDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [groups, setGroups] = useState<EditorGroup[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | "delete" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const latest = useRef({ title, description, groups });
  latest.current = { title, description, groups };
  const pending = useRef({ details: false, groups: false });
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<(() => void) | null>(null);

  const apply = useCallback((loaded: VerseListDto) => {
    setList(loaded);
    setTitle(loaded.title);
    setDescription(loaded.description ?? "");
    setGroups(keyed(loaded.groups));
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) =>
      getMyList(id, signal).then(apply, (err) => {
        if (signal?.aborted) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else onReady(() => void load());
      }),
    [id, apply],
  );

  useEffect(() => {
    if (!/^[A-Za-z0-9]{12}$/.test(id)) {
      setMissing(true);
      return;
    }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [id, load]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    chain.current = chain.current.then(async () => {
      const { title: t, description: d, groups: g } = latest.current;
      const doDetails = pending.current.details && t.trim().length > 0;
      const doGroups = pending.current.groups && g.every(isValidGroup);
      if (!doDetails && !doGroups) return;

      setSaveState("saving");
      try {
        let updated: VerseListDto | null = null;
        if (doDetails) {
          pending.current.details = false;
          updated = await updateListDetails(id, t.trim(), d.trim() || null);
        }
        if (doGroups) {
          pending.current.groups = false;
          const sent = g;
          updated = await replaceListGroups(id, sent.map(toDto));
          const saved = updated.groups;
          // New groups get their server ids; anything edited meanwhile stays as the reader left it
          setGroups((prev) =>
            prev.map((group) => {
              if (group.id != null) return group;
              const i = sent.findIndex((s) => s.key === group.key);
              return i >= 0 && saved[i] ? { ...group, id: saved[i].id } : group;
            }),
          );
        }
        if (updated) {
          setList(updated);
          noteListChanged(updated);
        }
        setSaveState(pending.current.details || pending.current.groups ? "saving" : "saved");
      } catch {
        if (doDetails) pending.current.details = true;
        if (doGroups) pending.current.groups = true;
        setSaveState("failed");
        if (!retry.current) {
          retry.current = onReady(() => {
            retry.current = null;
            void flush();
          });
        }
      }
    });
    return chain.current;
  }, [id, noteListChanged]);

  const schedule = useCallback(
    (kind: "details" | "groups") => {
      pending.current[kind] = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Save whatever is waiting when the reader leaves the editor
  useEffect(
    () => () => {
      retry.current?.();
      void flush();
    },
    [flush],
  );

  // Coming back to the tab picks up groups added from the reader elsewhere
  useEffect(() => {
    const onFocus = () => {
      if (pending.current.details || pending.current.groups || timer.current) return;
      void getMyList(id).then(apply, () => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [id, apply]);

  const updateGroups = (next: EditorGroup[]) => {
    setGroups(next);
    schedule("groups");
  };

  const addGroup = () => {
    const last = groups[groups.length - 1];
    const chapter = last?.chapter ?? 1;
    updateGroups([...groups, { key: `new-${nextKey++}`, id: null, chapter, fromVerse: 1, toVerse: 1, caption: null }]);
  };

  const moveGroup = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    updateGroups(next);
  };

  const runConfirmed = async () => {
    const action = confirm;
    setConfirm(null);
    if (!list || !action) return;
    setNote(null);
    try {
      if (action === "delete") {
        await deleteList(list.id);
        noteListDeleted(list.id);
        router.push("/saved/");
        return;
      }
      await flush();
      const updated = await setListPublished(list.id, action === "publish");
      setList(updated);
      noteListChanged(updated);
      if (action === "publish") trackEvent("list-published", { resultCount: updated.groups.length });
    } catch {
      setNote(LISTS_COPY.saveFailed);
    }
  };

  const handleShare = async () => {
    if (!list) return;
    const result = await shareList(window.location.origin, { ...list, title, description: description || null });
    if (result === "shared" || result === "copied") {
      trackEvent("list-shared", { method: result === "shared" ? "native" : "clipboard" });
    }
    if (result === "copied") setNote(LISTS_COPY.copiedLink);
    if (result === "failed") setNote(LISTS_COPY.shareFailed);
  };

  if (missing) {
    return (
      <main className={styles.main}>
        <div className="page-container">
          <EmptyState icon="listBullet" title={LISTS_COPY.notAvailableTitle} body={LISTS_COPY.notAvailableBody} />
        </div>
      </main>
    );
  }

  if (!list) return <AuthLoading />;

  const published = list.status === "published";
  const statusLine =
    saveState === "saving" ? LISTS_COPY.saving : saveState === "saved" ? LISTS_COPY.saved : saveState === "failed" ? LISTS_COPY.saveFailed : "";

  return (
    <main className={styles.main}>
      <div className="page-container">
        <div className={styles.topBar}>
          <h1 className={styles.heading}>
            {LISTS_COPY.editorHeading}
            <span className={`${styles.badge} ${published ? styles.badgePublished : ""}`}>
              {published ? LISTS_COPY.published : LISTS_COPY.draft}
            </span>
          </h1>
          <p className={styles.saveState} role="status" aria-live="polite">{statusLine}</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-title">{LISTS_COPY.titleLabel}</label>
          <input
            id="edit-title"
            className={`${styles.input} ${styles.titleInput}`}
            maxLength={LIST_LIMITS.title}
            placeholder={LISTS_COPY.titlePlaceholder}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              schedule("details");
            }}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-description">{LISTS_COPY.descriptionLabel}</label>
          <textarea
            id="edit-description"
            className={styles.input}
            rows={3}
            maxLength={LIST_LIMITS.description}
            placeholder={LISTS_COPY.descriptionPlaceholder}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              schedule("details");
            }}
          />
        </div>

        <h2 className={styles.groupsHeading}>{LISTS_COPY.groupsHeading}</h2>
        {groups.length === 0 && <p className={styles.empty}>{LISTS_COPY.noGroups}</p>}
        <ol className={styles.groups}>
          {groups.map((g, i) => (
            <GroupEditorRow
              key={g.key}
              group={g}
              index={i}
              count={groups.length}
              onChange={(changed) => updateGroups(groups.map((x) => (x.key === g.key ? changed : x)))}
              onMove={(delta) => moveGroup(i, delta)}
              onRemove={() => updateGroups(groups.filter((x) => x.key !== g.key))}
            />
          ))}
        </ol>
        {groups.length < LIST_LIMITS.groups && (
          <Button variant="secondary" icon="plus" onClick={addGroup}>
            {LISTS_COPY.addGroup}
          </Button>
        )}

        <div className={styles.actions}>
          {published ? (
            <>
              <Link href={listViewPath(list.id)} className={styles.viewLink}>{LISTS_COPY.view}</Link>
              <Button variant="secondary" icon="share" onClick={handleShare}>{LISTS_COPY.share}</Button>
              <Button variant="ghost" onClick={() => setConfirm("unpublish")}>{LISTS_COPY.unpublish}</Button>
            </>
          ) : (
            <Button onClick={() => setConfirm("publish")} disabled={title.trim().length === 0}>
              {LISTS_COPY.publish}
            </Button>
          )}
          <Button variant="ghost" icon="trash" className={styles.delete} onClick={() => setConfirm("delete")}>
            {LISTS_COPY.deleteList}
          </Button>
        </div>
        {note && <p className={styles.note} role="status">{note}</p>}
      </div>

      <ConfirmDialog
        isOpen={confirm != null}
        title={
          confirm === "publish" ? LISTS_COPY.publishTitle : confirm === "unpublish" ? LISTS_COPY.unpublishTitle : LISTS_COPY.deleteTitle
        }
        message={
          confirm === "publish" ? LISTS_COPY.publishMessage : confirm === "unpublish" ? LISTS_COPY.unpublishMessage : LISTS_COPY.deleteMessage
        }
        confirmLabel={
          confirm === "publish" ? LISTS_COPY.publish : confirm === "unpublish" ? LISTS_COPY.unpublish : LISTS_COPY.deleteList
        }
        variant={confirm === "delete" ? "danger" : "default"}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      />
    </main>
  );
}
