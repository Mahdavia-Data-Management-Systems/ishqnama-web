import { apiFetch, apiFetchWithOptionalAuth, authenticatedApiFetch } from "./api-client";
import type {
  ArabicVerseDto,
  FavoriteDto,
  VerseListDto,
  VerseListGroupDto,
  VerseListSummaryDto,
} from "@/types/lists";

// Owner (signed in)

export function getMyLists(signal?: AbortSignal): Promise<VerseListSummaryDto[]> {
  return authenticatedApiFetch<VerseListSummaryDto[]>("/user/lists", { signal });
}

export function createList(
  title: string,
  description: string | null,
  signal?: AbortSignal,
): Promise<VerseListDto> {
  return authenticatedApiFetch<VerseListDto>("/user/lists", {
    method: "POST",
    body: { title, description },
    signal,
  });
}

export function getMyList(id: string, signal?: AbortSignal): Promise<VerseListDto> {
  return authenticatedApiFetch<VerseListDto>(`/user/lists/${encodeURIComponent(id)}`, { signal });
}

export function updateListDetails(
  id: string,
  title: string,
  description: string | null,
): Promise<VerseListDto> {
  return authenticatedApiFetch<VerseListDto>(`/user/lists/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { title, description },
  });
}

export function replaceListGroups(id: string, groups: VerseListGroupDto[]): Promise<VerseListDto> {
  return authenticatedApiFetch<VerseListDto>(`/user/lists/${encodeURIComponent(id)}/groups`, {
    method: "PUT",
    body: { groups },
  });
}

export function appendListGroup(
  id: string,
  group: Omit<VerseListGroupDto, "id">,
  signal?: AbortSignal,
): Promise<VerseListDto> {
  return authenticatedApiFetch<VerseListDto>(`/user/lists/${encodeURIComponent(id)}/groups`, {
    method: "POST",
    body: group,
    signal,
  });
}

export function setListPublished(id: string, published: boolean): Promise<VerseListDto> {
  const action = published ? "publish" : "unpublish";
  return authenticatedApiFetch<VerseListDto>(`/user/lists/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
  });
}

export function deleteList(id: string): Promise<void> {
  return authenticatedApiFetch<void>(`/user/lists/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Published (anyone)

/** A published list. The token, when there is one, only tells the page whether the reader owns it. */
export function getPublishedList(id: string, signal?: AbortSignal): Promise<VerseListDto> {
  return apiFetchWithOptionalAuth<VerseListDto>(`/lists/${encodeURIComponent(id)}`, { signal });
}

/** Summaries of the published lists among `ids` (at most 50), in the order asked for. */
export function getPublishedSummaries(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<VerseListSummaryDto[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return apiFetch<VerseListSummaryDto[]>("/lists", { params: { ids: ids.join(",") }, signal });
}

/** The Arabic alone for verses `from` to `to` of a chapter: no translation, no tafseer, no token. */
export function getChapterArabic(
  chapter: number,
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<ArabicVerseDto[]> {
  return apiFetch<ArabicVerseDto[]>(`/chapters/${chapter}/arabic`, { params: { from, to }, signal });
}

// Favourites (signed in)

export function getFavorites(signal?: AbortSignal): Promise<FavoriteDto[]> {
  return authenticatedApiFetch<FavoriteDto[]>("/user/favorites", { signal });
}

export function saveListFavorite(listId: string): Promise<FavoriteDto> {
  return authenticatedApiFetch<FavoriteDto>("/user/favorites", {
    method: "PUT",
    body: { kind: "list", listId },
  });
}

export function deleteFavorite(id: string): Promise<void> {
  return authenticatedApiFetch<void>(`/user/favorites/${encodeURIComponent(id)}`, { method: "DELETE" });
}
