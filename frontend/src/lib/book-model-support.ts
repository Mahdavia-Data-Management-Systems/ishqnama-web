type NavigatorWithHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

/**
 * Whether this browser should render the book with WebGL. When false the poster image is the
 * finished experience: reduced motion (the tilt is motion), Save-Data, a low-memory device, or
 * no WebGL 2. Never throws.
 */
export function canRenderBook(win: Window = window): boolean {
  try {
    if (win.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;

    const nav = win.navigator as NavigatorWithHints;
    if (nav.connection?.saveData) return false;
    if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 2) return false;

    const canvas = win.document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return false;
    // Release the probe context so it does not count against the browser's context limit.
    (gl.getExtension("WEBGL_lose_context") as { loseContext(): void } | null)?.loseContext();
    return true;
  } catch {
    return false;
  }
}
