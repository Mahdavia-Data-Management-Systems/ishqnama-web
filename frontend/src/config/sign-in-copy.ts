/**
 * Every user-facing string of the shared sign-in prompt.
 *
 * Readers are often unfamiliar with technology, so nothing here says "service", "API",
 * "server", "account", "log in", "authenticate" or "session". Each string is sentence case and
 * under twelve words: one fact, one action. `src/config/__tests__/sign-in-copy.test.ts` enforces
 * these rules. To add an account-only feature, add its name to `SignInFeature` and its title and
 * body here, then wrap the action at the call site with `useSignInGate("<feature>")`.
 */

export type SignInFeature = "settings" | "saved" | "bookmark" | "search";

export interface SignInCopy {
  /** Sheet heading, also the inline empty-state title where a page shows one. */
  title: string;
  /** One line under the heading saying what signing in unlocks. */
  body: string;
}

export const SIGN_IN_COPY: Record<SignInFeature, SignInCopy> = {
  settings: {
    title: "Sign in to keep your reading settings",
    body: "Choose how Noor e Imaan reads for you, saved for later.",
  },
  saved: {
    title: "Sign in to see your bookmarks",
    body: "Your bookmarks, favourites and reading history live here.",
  },
  bookmark: {
    title: "Sign in to bookmark this ayah",
    body: "Mark your place and return to it from any device.",
  },
  search: {
    title: "Sign in to search",
    body: "Search the tarjuma and tafseer of Noor e Imaan.",
  },
};

export const SIGN_IN_LABEL = "Sign in";
export const NOT_NOW_LABEL = "Not now";
export const SIGN_IN_CREDIT = "Sign in provided by Mahdavia Data Management System";
