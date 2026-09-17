/**
 * Every user-facing string shown while the API is warming or unreachable.
 *
 * The audience includes readers unfamiliar with technology, so nothing here
 * says "service", "API", "server", "waking up" or "cold start". States are
 * phrased in terms of what the reader is getting: the text, their bookmarks,
 * their settings. Keep the spelling "Noor e Imaan", as on the home page.
 */

export const WARMING_MESSAGE =
  "Preparing Noor e Imaan text, this usually takes under a minute";
export const UNREACHABLE_MESSAGE =
  "Still preparing. Please check your internet connection.";
export const TRY_AGAIN_LABEL = "Try again";

export const BOOKMARKS_WARMING_MESSAGE = "Your bookmarks will appear shortly";
export const BOOKMARKS_UNREACHABLE_MESSAGE = "Couldn't load your bookmarks yet";

export const CREATE_BOOKMARK_HELPER =
  "Noor e Imaan is getting ready, this may take up to a minute";
export const CREATE_BOOKMARK_WAITING_LABEL = "Creating, please wait";
export const CREATE_BOOKMARK_TIMEOUT_ERROR =
  "Couldn't create the bookmark yet. Please try again.";

export const SETTINGS_WARMING_MESSAGE =
  "Your changes apply now and will be saved shortly";
export const SETTINGS_UNREACHABLE_MESSAGE =
  "Your changes apply now but couldn't be saved yet";
export const SETTINGS_LOADING_MESSAGE = "Loading your saved settings";
