/**
 * Canonical class strings for shared input chrome.
 *
 * See designsystem.md §4.2 for the rules these encode. When adding a
 * new input style, extend here rather than writing one-off classes.
 *
 * State coverage: default / hover / focus / disabled. Hover lifts the
 * border to `line-2` for affordance; disabled dims the field and
 * disables the text cursor.
 */

const INPUT_STATES =
  "hover:border-line-2 focus:border-line-2 disabled:opacity-50 disabled:cursor-not-allowed";

export const INPUT =
  `bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md outline-none transition-colors placeholder:text-fg-3 w-full ${INPUT_STATES}`;

// Smaller, denser variant — used in list rows and inline editors.
export const INPUT_SM =
  `bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md outline-none transition-colors placeholder:text-fg-3 w-full ${INPUT_STATES}`;

// Mono caps input for short codes / tags (e.g. spec grid label, day label).
export const INPUT_MONO =
  `bg-bg-2 border border-line px-[14px] py-[11px] text-[13px] rounded-md outline-none transition-colors placeholder:text-fg-3 w-full font-mono tracking-[0.05em] uppercase ${INPUT_STATES}`;
