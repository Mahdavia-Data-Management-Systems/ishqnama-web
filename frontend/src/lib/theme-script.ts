/**
 * The hook-free half of the theme: types, storage key, browser bar colours and the inline head
 * script. It lives apart from src/lib/theme.ts so the root layout, a server component, can
 * import it without pulling in React's client hooks.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ishqnama-theme";

/** The browser bar colour for each theme: the app bar's chrome colour. */
export const THEME_COLOR = { light: "#004446", dark: "#00292B" } as const;

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Inline script for the document head. It must stay self-contained ES5: it runs before any bundle. */
export function themeScript(): string {
  return `(function(){
var p="system";
try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(s==="light"||s==="dark"||s==="system")p=s;}catch(e){}
var d=p==="dark"||(p==="system"&&typeof window.matchMedia==="function"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);
var t=d?"dark":"light";
var h=document.documentElement;
h.setAttribute("data-theme",t);
h.style.colorScheme=t;
var m=document.querySelectorAll('meta[name="theme-color"]');
for(var i=0;i<m.length;i++)m[i].setAttribute("content",d?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)});
})();`;
}
