import { authenticatedApiFetch } from "./api-client";
import type { EssayDto } from "@/types/articles";

/** One Noor e Imaan essay. Signed-in readers only, so the text never ships in the static pages. */
export function getNoorEImaanEssay(slug: string, signal?: AbortSignal): Promise<EssayDto> {
  return authenticatedApiFetch<EssayDto>(`/articles/nooreimaan/${encodeURIComponent(slug)}`, { signal });
}
