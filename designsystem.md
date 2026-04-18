# TripCrew — Design System

**One source of truth** for every visual and interaction choice in the app. If something on screen doesn't match this doc, the doc is probably right; fix the screen.

Companion to [globals.css](src/app/globals.css) (which owns the actual CSS variables) and [CLAUDE.md](CLAUDE.md) (which owns engineering conventions).

---

## 1. Principles

The product is a planning tool for friends organising real money, real time, real travel. The interface has to feel **trusted, calm, and fast** — premium in the way a good travel notebook feels, not in the way a luxury car ad does.

**Four rules we never break:**

1. **Editorial over decorative.** Type carries the hierarchy. Dividers are hairline. No shadows, no gradients (one exception: the hero radial on sign-in). No rounded-full on anything except avatars, status dots, and pill filters.
2. **One accent, intentionally.** Coral-orange (`accent`) is the only colour that says "act now" or "this is live". If three things on screen are orange, nothing is.
3. **Whitespace is a primitive.** Generous vertical rhythm and breathing room around display type are load-bearing. Tight columns belong in data, not UI chrome.
4. **Every state is designed.** Loading, empty, and error are not afterthoughts — they need the same rigour as the happy path.

**Anti-patterns we reject** (flag these in review):

- Decorative icons next to every text label
- Multi-word CTAs that could be one word ("Click to save your trip" → "Save")
- Modal dialogs for confirmations that toast+undo could handle
- Shadows to imply depth (use lines)
- Gradients to imply excitement
- Vertical rows that stagger widths (see the vote-deadline input incident, 2026-04-17)

---

## 2. Tokens

Tokens are defined in [globals.css](src/app/globals.css) as CSS custom properties and exposed to Tailwind via `@theme`. **Never hardcode a hex; always use the token.**

### 2.1 Colour

```
--color-bg        #0A0A0B   near-black canvas
--color-bg-2      #131315   elevated surface (cards, inputs, popovers)
--color-bg-3      #1C1C1F   hover / pressed background
--color-fg        #F0F0F0   primary text, display
--color-fg-2      #A8A8AD   secondary text (passes AA: 6.2:1)
--color-fg-3      #6B6B70   decorative / metadata only (FAILS AA: 3.5:1)
--color-fg-4      #3E3E42   non-informational ornament only (FAILS all)
--color-accent    #FF4C15   brand; action; "live" state — use once per screen
--color-accent-dim  rgba(255,76,21,0.12)  accent fill behind selected rows
--color-ok        #5FE388   success / positive balance
--color-warn      #F5C451   caution / deadline approaching
--color-err       #F0556C   destructive / error (distinct from accent hue)
--color-line      rgba(255,255,255,0.08)   hairline divider
--color-line-2    rgba(255,255,255,0.14)   secondary border, hover state
```

**Usage rules:**

- **`fg`** — the only colour for text the user needs to read: trip names, headings, values, button labels.
- **`fg-2`** — body prose, helpers, subheads. Legal contrast floor for informational text.
- **`fg-3`** — labels like `TARGET BUDGET`, timestamps, "3 days left". Decorative metadata that adds context but isn't the message. **Never use for sentence-length text.**
- **`fg-4`** — disabled states, empty-slot placeholders, ornament only. If a user might read it to understand something, it's wrong.
- **`accent`** — one element per visible area: the primary CTA, a single "live now" indicator, a selected tab. Using it for both a button and a status dot dilutes both.
- **`ok` / `warn` / `err`** — semantic colour; never paint large areas with them. Use as text or thin fills (≤2px borders, background opacity ≤0.1).
- **`line`** — all dividers, card borders. **Never `bg-4` as a line.**
- **`bg-2`** — every interactive surface (input, button base, popover). `bg-3` only on hover/press.

**Contrast commitments:**

| Use | Min ratio | What we use |
|---|---|---|
| Display / heading | 7:1 | fg on bg |
| Body text | 4.5:1 | fg or fg-2 on bg |
| Subtext (≥16px) | 3:1 | fg-2 on bg |
| Decorative metadata only | — | fg-3 on bg |

If a line of text matters and is smaller than 14px, use **fg-2 minimum**.

### 2.2 Typography

Two fonts, loaded in [app/layout.tsx](src/app/layout.tsx):

```
--font-sans   Inter Tight      300, 400, 500, 600, 700
--font-mono   JetBrains Mono   400, 500
```

**Pick a font first, pick a weight second, pick a size last.** `sans` is the default; `mono` is only for metadata / labels / tabular numbers / codes (`§ 01`, `LOCKED`, `23 JUL 26`).

#### Type scale

All roles below exist as **real CSS utility classes** in [globals.css](src/app/globals.css) under `@layer components`. Prefer them over raw arbitrary values so the scale stays consistent.

| Role | Class | Size | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `display-xl` | inline clamp | clamp(64px, 13vw, 180px) | 700 | -0.055em | Hero trip title ("Stockholm.") |
| `display-lg` | `.display-lg` | 56 | 600 | -0.04em | Sign-in hero, dashboard H1 |
| `display-md` | `.display-md` | 48 | 500 | -0.03em | Stat card value |
| `display-sm` | `.display-sm` | 28 | 500 | -0.02em | Card titles, locked destination |
| `title` | `.title` | 22 | 500 | -0.02em | Admin section title, spec cell value |
| `heading` | `.heading` | 20 | 500 | -0.02em | Schedule day heading |
| `subheading` | `.subheading` | 17 | 500 | -0.015em | Vote row title, crew name |
| `body` | default | 14 | 400 | -0.01em | Paragraphs, form inputs |
| `body-sm` | `.body-sm` | 13 | 400 | 0 | Helper text, meta |
| `body-xs` | `.body-xs` | 12 | 400 | 0 | Calendar cells, footnotes |
| `label` | `.label` | 11 mono | — | 0.15em uppercase | Section labels, STATUS, TARGET BUDGET |
| `label-sm` | `.label-sm` | 10 mono | — | 0.15em uppercase | Most chip badges (default of `<Badge>`) |
| `label-sm-wide` | `.label-sm-wide` | 10 mono | — | 0.18em uppercase | Labels above display values (stat cells, section codes) |
| `label-xs` | `.label-xs` | 9 mono | — | 0.18em uppercase | Dense meta (calendar weekday, `<Badge size="sm">`) |

**Tracking rules:**

- Display (≥40px): negative tracking, `-0.03em` to `-0.055em` — bigger = tighter.
- Body: `0` to `-0.01em`.
- Mono caps: positive tracking, `0.08em` minimum, `0.18em` max. Shorter labels → tighter tracking (`STATUS` at `0.1em`); longer prose-ish labels → looser (`DECISION MADE` at `0.15em`).

**Numbers:** when stats, prices, dates, or times appear, add `tabular` (CSS `font-variant-numeric: tabular-nums`). The utility class is in [globals.css](src/app/globals.css). All ledger amounts, vote counts, stat values, and clock times are tabular.

### 2.3 Spacing

Single scale, 4-based. **Tailwind's default scale is our scale.** Avoid arbitrary `[11px]`, `[14px]`, etc. except for input padding (see component rules).

```
0   0
1   4px     inline chip padding
2   8px     gap between related items
3   12px    gap between meta items
4   16px    standard form field gap
5   20px    form section gap, dense card padding
6   24px    card padding, stat cell padding
7   28px    page horizontal padding, form max-width inner
8   32px    section internal gap
10  40px    section gap (within a page)
14  56px    vertical section gap (page-level)
16  64px    hero top padding
```

**Rules:**

- **Form fields** gap `5` (20px). Always.
- **Inside a card**, padding `6` or `7`. Don't mix — pick one per card.
- **Page sections** separated by `py-14 pb-24` (56 top, 96 bottom of the final section).
- **Between content blocks** inside a section, use `mt-8` or `mt-10`, never random values.
- **Pills / chips**: `py-[6px] px-[12px]` is an exception (tighter than the scale for visual balance with short copy).

**Exception — input padding:** the input chrome uses `px-[14px] py-[11px]`. This lands between scale `3` (12px) and `4` (16px) for the right optical weight against our 13–15px text. Treat it as a canonical token, not a one-off. Defined in multiple components — eventual consolidation planned.

### 2.4 Borders & radii

```
border        1px solid var(--color-line)      default
border + line-2   1px solid var(--color-line-2)   hover, focus, highlighted
```

- **All hairlines are `line` at 1px.** No 2px, no double borders.
- **Radii**:
  - `rounded` (4px) on small elements (calendar cells, focus ring).
  - `rounded-md` (6px) on inputs, buttons, popovers.
  - `rounded-full` only on circular dots, pills, and avatars.
  - **Cards are sharp** — no radius. The editorial, magazine-y aesthetic depends on it. If an element feels like a "card", use the [Card](src/components/ui/Card.tsx) component which encodes this.
- **No shadows**, ever — except popovers (DatePicker, TripSwitcher, MoneyInput currency menu) which need `shadow-lg` to read as floating.

### 2.5 Motion

Use sparingly. Motion should confirm or orient — never decorate.

```
duration   150ms    micro-feedback (hover, focus)
duration   200ms    state changes (open/close popover)
duration   250ms    section enter (new page)

easing     ease     default
```

Predefined animations in [globals.css](src/app/globals.css):

- `.section-enter` — 0.25s opacity + translateY(6px → 0). Applied to every `<section>` on page load.
- `.brand-pulse` — 2s infinite on the top-bar brand dot only.

**Don't animate** colour changes longer than 200ms, list reorders, layout thrash, or anything triggered by a route change.

---

## 3. Layout

### 3.1 Grid

- **Max width**: 1280px. Main content is `max-w-[1280px] mx-auto`.
- **Horizontal padding**: `px-7` (28px). Applied in the app layout, not in individual pages.
- **Form max width**: `max-w-[560px]`. Single-column forms always. Pairing fields horizontally in a 2-col grid is allowed *only* when the two fields are a semantic pair (start/end dates). Never pair a single field with an empty cell (learned, painfully).

### 3.2 Breakpoints

```
default     single column, stacked, full-width cards
≥ 520px     two-column form grids allowed
≥ 780px     stat cells can go 4-wide; vote rows 3-col
≥ 900px     spec grid 4-wide
```

We use `max-[Npx]:` Tailwind arbitrary breakpoints rather than default sm/md/lg. This is deliberate — the layout breaks at data-driven widths, not browser conventions.

### 3.3 Stickiness

- **Top bar** is `sticky top-0 z-50 backdrop-blur-md` on every authed page.
- Nav tabs are **not** sticky — let them scroll with content.

### 3.4 Vertical rhythm inside a page

```
<TopBar />                              sticky
  ↓ top-bar height
<Hero />                                pt-[70px] pb-[60px], border-b
  ↓
<Nav />                                 py-4, border-b
  ↓
<main>
  <section class="py-14 pb-24">        56 top, 96 bottom
    <SectionHeader />                   mb-10
    <content />                         blocks separated by mt-8 / mt-10
  </section>
</main>
```

---

## 4. Components

### 4.1 Button

Canonical API in [components/ui/Button.tsx](src/components/ui/Button.tsx).

| Variant | Use |
|---|---|
| `primary` | The single most important action on screen (Save, Create, Lock) |
| `secondary` | Supporting actions (Propose, Add row) |
| `destructive` | Delete, Remove, Revoke |
| `icon` | Single-glyph actions (✕, ↑, ↓) |

**Rules:**

- One `primary` per form / per section. Never two.
- `destructive` always requires confirmation (typed name for trip delete, native `confirm()` for member remove, undo-toast for expense delete).
- Icon buttons must have `aria-label`.
- Pending state is a text swap ("Save" → "Saving…"), not a spinner.

### 4.2 Input (text / number / textarea)

Canonical class:
```
bg-bg-2 border border-line px-[14px] py-[11px] text-[15px]
rounded-md focus:border-line-2 outline-none transition-colors
placeholder:text-fg-3 w-full
```

**Rules:**

- No `:ring`; we use border-colour for focus only.
- Placeholder is `fg-3` (OK because it's not load-bearing text).
- Number inputs never show the native spinner arrows (stripped in globals.css).
- Date / datetime inputs are **never native** — use [DatePicker](src/components/ui/DatePicker.tsx) / [DateTimePicker](src/components/ui/DateTimePicker.tsx).
- Currency / money inputs use [MoneyInput](src/components/ui/MoneyInput.tsx) with the currency selector built in.

### 4.3 Field (form row wrapper)

[components/ui/Field.tsx](src/components/ui/Field.tsx) injects `id`, `name`, `aria-describedby`. Usage:

```tsx
<Field label="Trip name" name="name" required helper="Shown on the topbar.">
  <input className={INPUT_CLASS} />
</Field>
```

- Label is `label` type style, always uppercase mono.
- Helper is `body-sm` in `fg-3` (acceptable because it's decorative context, not instruction).
- Error replaces helper and uses `err` colour.

### 4.4 Card / Panel

- `bg-bg-2 border border-line rounded-md` is the default surface.
- Padding is `p-6` (most cases) or `p-7` (dense admin cards).
- Don't nest cards inside cards. If you feel like you need to, add a divider instead.

### 4.5 Stat cell

Hero stats pattern (four cells across, `border-r` hairlines). The **inner padding is symmetric** (`p-6` or `py-6 px-6`), **not** `py-6 pr-6 pl-0` — that was a bug and is being fixed.

```tsx
<div className="p-6 border-r border-line last:border-r-0">
  <div className="label text-fg-3 mb-3">LABEL</div>
  <div className="display-md tabular">
    {value}
    {unit && <span className="text-fg-3 text-[20px] ml-[2px]">{unit}</span>}
  </div>
  <div className="body-xs text-fg-3 mt-[6px] font-mono tracking-[0.05em]">
    {sub}
  </div>
</div>
```

### 4.6 Section header

[components/layout/SectionHeader.tsx](src/components/layout/SectionHeader.tsx). Renders:
- `§ 0X` code in `accent`, mono, `label`
- Title in `display-sm`
- Lead paragraph in `body` / `fg-2`

Always the first thing inside a `<section>` that isn't the Hero.

### 4.7 Badge (**planned**, not yet built)

A component for short uppercase-mono status labels. Currently these are inlined per-component:

- "Admin" in [CrewManagement](src/components/admin/CrewManagement.tsx)
- "LOCKED" / "PLANNING" in [Hero](src/components/layout/Hero.tsx)
- "You" in [CrewList](src/components/crew/CrewList.tsx)
- "Leading" in [Destinations](src/components/destinations/Destinations.tsx)

Target API:
```tsx
<Badge tone="accent | ok | warn | err | neutral" size="sm | md">LOCKED</Badge>
```

### 4.8 Toast

[hooks/useToast.ts](src/hooks/useToast.ts) wrapping Sonner.

- Success for confirmation of a discrete action.
- Error for server-side failures (never for validation — that belongs inline on the field).
- Undo pattern for deletes: "X removed" with a 5-second window to undo before commit.
- Info for neutral system messages.
- **Don't stack three toasts** — each action should fire one toast max.

### 4.9 Popover / Menu

Every dropdown (trip switcher, currency picker, date picker) is a custom popover. The canonical pattern is:

- Trigger button with `aria-haspopup` and `aria-expanded`.
- Positioned absolutely below the trigger (`top-[calc(100%+6px)]`).
- Closes on outside click, Escape, and route change.
- Uses `bg-bg-2 border border-line rounded-md shadow-lg` as its surface (only place we use `shadow-lg` — because popovers genuinely need to "float").

This is one of the few places where we allow a shadow, because popovers must read as temporary.

### 4.10 Row (list / table)

Data rows use hairline dividers inside a border container:

```tsx
<div className="border border-line">
  <div className="py-4 px-6 border-b border-line last:border-b-0">…</div>
  <div className="py-4 px-6 border-b border-line last:border-b-0">…</div>
</div>
```

Mobile rows stack. Desktop uses `grid-cols-[...]` with named tracks. Never `flex justify-between` for a row that might wrap — the columns will misalign.

---

## 5. Copy & voice

**Tone**: confident, brief, conversational but not chatty. Match how you'd text a friend about logistics, not how you'd write a marketing email.

- Headlines: direct and short. "Plan it together." not "Plan your dream vacation effortlessly."
- Buttons: one or two words when possible. "Save" not "Save changes".
- Helpers: one sentence, ends with a period. Never a question.
- Empty states: name the thing that's absent, then say how to get it. "No candidates · propose one" not "You don't have any destinations yet. Click below to add your first destination."
- Errors: what's wrong, not what to do. "Name doesn't match." not "Please type the name correctly."

**Casing:**

- Sentence case for UI copy: buttons, inputs, body, headlines. "Save identity" not "Save Identity" or "SAVE IDENTITY".
- UPPERCASE MONO for metadata / labels / status / codes. `TARGET BUDGET`, `LOCKED`, `§ 01`.

**Numbers and money:**

- Never bare. Always `£1,000` (formatted), `95d`, `2 / 5`, `3 YES`.
- Time: `21:41`, never `9:41 PM`.
- Dates: `23 JUL 26` (mono, uppercase) for metadata; `23 July 2026` (sentence) for body.

**Currency:** lives on the trip (`trip.currency`). Never hard-code `£`.

---

## 6. Accessibility

Non-negotiables:

- Every interactive element is reachable by keyboard.
- Every icon-only button has an `aria-label`.
- Form inputs have associated `<label>` (via Field component).
- Focus is **always** visible — a 2px `accent` outline with 2–3px offset, scoped to `:focus-visible` (keyboard focus only). Defined globally in [globals.css](src/app/globals.css). Never add `outline: none` without a replacement.
- Colour is never the only signal. Status chips also carry text. Vote counts don't rely on colour alone.
- Error messages are associated to the field via `aria-describedby`.
- Modal dialogs trap focus.

**Known gaps**:

- Popovers lack `role="dialog"` in some cases (DatePicker does, currency picker is a `role="listbox"`).
- No skip-to-content link yet.
- Axe audit not yet run.

---

## 7. Data density

Every screen should feel:

- **Scannable** — a user should find the thing they came for in one saccade.
- **Deliberate** — nothing is on screen that the user won't touch or read.
- **Calm** — dense data yes, but never noisy. Hairline dividers do the organisation; type weight does the hierarchy.

If a screen has more than ~8 interactive controls in view without a section header between them, reconsider.

---

## 8. What we don't do

- ❌ Shadows (except the single popover case, for floating semantics)
- ❌ Gradients (except the hero radial on the sign-in page)
- ❌ Rounded-full on anything except avatars, dots, pills
- ❌ Emojis in the UI
- ❌ Icons next to every text label
- ❌ Multi-word button labels when one word works
- ❌ Confirmations via modal when a toast+undo works
- ❌ Inline styles (use Tailwind classes)
- ❌ New hex codes outside the token set
- ❌ Type sizes outside the scale in Section 2.2
- ❌ Arbitrary spacing like `mb-[13px]` (use the spacing scale)
- ❌ `font-weight: 800` or higher (we stop at 700)

---

## 9. Checklist for new components

Before merging a new component, confirm every row:

- [ ] Uses tokens from Section 2, not raw hex / arbitrary sizes
- [ ] Text colour matches Section 2.1 usage rules (fg-3 decorative only)
- [ ] Type style matches one of the named roles in 2.2
- [ ] Spacing is on the scale (Section 2.3)
- [ ] Focus state visible without mouse
- [ ] `aria-label` on any icon-only button
- [ ] Pending / empty / error states designed
- [ ] Works at 320px width (mobile)
- [ ] Works at 1280px width (desktop)
- [ ] Copy follows Section 5

---

## 10. Known inconsistencies

Tracked gaps between this doc and the current codebase. Not blockers, but address when touching the area:

- **Mixed arbitrary typography**: some existing components still use `font-mono text-[10px] tracking-[0.15em] uppercase` inline instead of the `.label-sm` utility. Migrate as you touch each file.
- **Inline input classes**: Calendar cells, custom button-like inputs (picker triggers) use bespoke styling. That's intentional — they're not text inputs. Everything that IS a text input or textarea should import from `@/lib/styles`.
- **AdminPlaceholder** is about to be deleted once the last admin section editor ships.

---

## 11. Evolving this document

Treat this file as code, not documentation. When you introduce a new pattern (component, colour, scale):

1. If it belongs, update the right section here **in the same PR**.
2. If it doesn't belong, reconsider before adding it.
3. If the system needs a new primitive (e.g., we genuinely need a second accent colour), discuss first — every addition raises the complexity floor.

The goal is for this document to stay **shorter and sharper over time**, not longer. Prune as you go.
