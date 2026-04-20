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

// Canonical input padding — lands between scale 3 and 4 for the right
// optical weight against 13–15px text. Shared by every text input,
// picker trigger, and composite so the magic numbers appear once.
export const INPUT_PADDING = "px-[14px] py-[11px]";

const INPUT_STATES =
  "hover:border-line-2 focus:border-line-2 disabled:opacity-50 disabled:cursor-not-allowed";

export const INPUT =
  `bg-bg-2 border border-line ${INPUT_PADDING} text-[15px] rounded-md outline-none transition-colors placeholder:text-fg-3 w-full ${INPUT_STATES}`;

// Smaller, denser variant — used in list rows and inline editors.
export const INPUT_SM =
  `bg-bg-2 border border-line ${INPUT_PADDING} text-sm rounded-md outline-none transition-colors placeholder:text-fg-3 w-full ${INPUT_STATES}`;

// Mono caps input for short codes / tags (e.g. spec grid label, day label).
export const INPUT_MONO =
  `bg-bg-2 border border-line ${INPUT_PADDING} text-[13px] rounded-md outline-none transition-colors placeholder:text-fg-3 w-full font-mono tracking-[0.05em] uppercase ${INPUT_STATES}`;

// Picker-trigger chrome — matches INPUT visually but carries button
// semantics: cursor-pointer, flex row for a chevron glyph, disabled
// lightens rather than dims. Used by DatePicker, DateRangePicker,
// DateTimePicker, and any future popover trigger that should read as
// an input field.
export const INPUT_TRIGGER =
  `w-full flex items-center justify-between gap-3 bg-bg-2 border border-line ${INPUT_PADDING} text-[15px] rounded-md hover:border-line-2 focus:border-line-2 outline-none transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default`;
