/**
 * Whether a pathname is a reader page: any `/quran/*` route except the
 * chapter index itself, and any essay under `/articles/nooreimaan/`. Reader
 * pages mount the fixed ReaderToolbar along the bottom edge, so the bottom
 * nav hides there and the footer clears the toolbar instead.
 */
export function isReaderRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/quran/")) return pathname !== "/quran/";
  return pathname.startsWith("/articles/nooreimaan/") && pathname !== "/articles/nooreimaan/";
}
