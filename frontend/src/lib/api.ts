import { apiFetch } from "@/lib/api-client";
import type {
  ChapterDetailDto,
  ChapterDto,
  JuzDto,
  PagedResponse,
  RukuDto,
  TranslationDto,
  VerseDto,
} from "@/types/api";

// --- Chapters ---

export function getChapters(lang?: string, signal?: AbortSignal) {
  return apiFetch<ChapterDto[]>("/chapters", {
    params: { lang },
    signal,
  });
}

export function getChapter(num: number, signal?: AbortSignal) {
  return apiFetch<ChapterDetailDto>(`/chapters/${num}`, { signal });
}

export function getChapterVerses(
  num: number,
  opts?: { translationId?: number; page?: number; pageSize?: number },
  signal?: AbortSignal,
) {
  return apiFetch<PagedResponse<VerseDto>>(`/chapters/${num}/verses`, {
    params: {
      translationId: opts?.translationId,
      page: opts?.page,
      pageSize: opts?.pageSize,
    },
    signal,
  });
}

export function getVerse(
  chapterNum: number,
  verseNum: number,
  signal?: AbortSignal,
) {
  return apiFetch<VerseDto>(`/chapters/${chapterNum}/verses/${verseNum}`, {
    signal,
  });
}

// --- Verses (cross-chapter range) ---

export function getVerseRange(
  from: string,
  to: string,
  translationId?: number,
  signal?: AbortSignal,
) {
  return apiFetch<VerseDto[]>("/verses", {
    params: { from, to, translationId },
    signal,
  });
}

// --- Juz ---

export function getJuz(signal?: AbortSignal) {
  return apiFetch<JuzDto[]>("/juz", { signal });
}

export function getJuzVerses(
  num: number,
  opts?: { translationId?: number; page?: number; pageSize?: number },
  signal?: AbortSignal,
) {
  return apiFetch<PagedResponse<VerseDto>>(`/juz/${num}/verses`, {
    params: {
      translationId: opts?.translationId,
      page: opts?.page,
      pageSize: opts?.pageSize,
    },
    signal,
  });
}

// --- Rukus ---

export function getRukus(
  opts?: { chapterNum?: number; juzNum?: number },
  signal?: AbortSignal,
) {
  return apiFetch<RukuDto[]>("/rukus", {
    params: { chapterNum: opts?.chapterNum, juzNum: opts?.juzNum },
    signal,
  });
}

export function getRukuVerses(
  id: number,
  translationId?: number,
  signal?: AbortSignal,
) {
  return apiFetch<VerseDto[]>(`/rukus/${id}/verses`, {
    params: { translationId },
    signal,
  });
}

// --- Translations ---

export function getTranslations(signal?: AbortSignal) {
  return apiFetch<TranslationDto[]>("/translations", { signal });
}

// --- Health ---

export function getHealth(signal?: AbortSignal) {
  return apiFetch<{ status: string }>("/healthz", { signal });
}
