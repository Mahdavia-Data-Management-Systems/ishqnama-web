/**
 * Stops the page scrolling behind a sheet or dialog, keeping the reader's place.
 *
 * The lock goes on <html>, not <body>. `globals.css` gives both `height: 100%` and
 * `overflow-x: clip`, and because <html> has an overflow of its own the browser no longer hands
 * <body>'s overflow to the window: `overflow: hidden` on <body> turns the body itself into a
 * one-screen-tall clipped box, the window has nothing left to scroll, and the page jumps to the
 * top. <html>'s overflow always applies to the window, which keeps its scroll position.
 *
 * Locks are counted, so a sheet opened over another (the sign-in prompt over the Share sheet)
 * does not unlock the page when the top one closes. Each lock returns its own release, which is
 * safe to call more than once.
 */
let locks = 0;

export function lockPageScroll(): () => void {
  locks += 1;
  if (locks === 1) document.documentElement.style.overflow = "hidden";

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) document.documentElement.style.overflow = "";
  };
}
