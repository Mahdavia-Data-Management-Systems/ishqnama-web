/** Which list the Quran index shows: chapters or juz. */
export type QuranIndexView = "sura" | "juz";

export const DEFAULT_QURAN_INDEX_VIEW: QuranIndexView = "sura";

const STORAGE_KEY = "quran-index-view";

/** The reader's last Sura/Juz choice in this browser, or the default when none is saved or storage is unavailable. */
export function readQuranIndexView(): QuranIndexView {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "sura" || saved === "juz" ? saved : DEFAULT_QURAN_INDEX_VIEW;
  } catch {
    return DEFAULT_QURAN_INDEX_VIEW;
  }
}

/** Remembers the choice in this browser; silently does nothing when storage is blocked. */
export function saveQuranIndexView(view: QuranIndexView): void {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Private windows and blocked site data: the index still works, it just won't remember.
  }
}
