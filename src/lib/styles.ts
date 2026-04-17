/**
 * Canonical class strings for shared input chrome.
 *
 * See designsystem.md §4.2 for the rules these encode. When adding a
 * new input style, extend here rather than writing one-off classes.
 */

export const INPUT =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full";

// Smaller, denser variant — used in list rows and inline editors.
export const INPUT_SM =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full";

// Mono caps input for short codes / tags (e.g. spec grid label, day label).
export const INPUT_MONO =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[13px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full font-mono tracking-[0.05em] uppercase";
