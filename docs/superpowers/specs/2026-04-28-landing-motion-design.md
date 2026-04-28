# Landing page · motion + interactivity

Status: draft for review
Owner: Nigel
Date: 2026-04-28
Library: [Motion for React](https://motion.dev/docs/react) (`motion` package, the successor to framer-motion). Hybrid Web Animations API + JS engine, ~6kb min for `LazyMotion(domAnimation)`.

## Goal

Add motion and interactivity to the public landing page so it feels alive without feeling animated. The bar is "premium magazine site, not SaaS marketing template." Every motion choice should read as *deliberate and weighty*, not playful.

## Non-goals

- No bouncy springs on entrances. No `whileTap` scale-down on buttons. No emoji/confetti.
- No motion on the application form, curated trip pages, or authed app routes (separate scope).
- No replacing the current visual design. Motion *enhances* the editorial-brutalist baseline; it does not replace surfaces with glass or animated gradients.
- No third-party motion libraries beyond `motion`.

## Design principles

1. **Tweens over springs.** Default ease is a custom out-expo `cubic-bezier(0.22, 1, 0.36, 1)`. Springs are reserved for drag and physical gestures only, never for entrances.
2. **Slow on entry, fast on intent.** Entrances 0.6 to 0.9s. Hovers and taps 0.16 to 0.22s. Stagger delta 60 to 80ms.
3. **Opacity and translate. Not scale.** Most reveals are `opacity` + `y: 12px to 24px`. Scale is reserved for image Ken Burns and hero-card lift, never for text.
4. **One motion idea per surface.** A section either staggers its rows, OR has a parallax background, OR has a count-up. Never all three.
5. **Reduced-motion is first class.** `MotionConfig reducedMotion="user"` strips transforms automatically; manual fallbacks for count-ups and crossfades.
6. **Performance budget.** Total motion JS bundle delta under 12kb gzipped. No layout thrash. No more than 8 in-flight animations on any frame.

## Architecture

```
src/lib/motion/
  ├── MotionRoot.tsx         # client wrapper: LazyMotion + MotionConfig, mounted in (public) layout
  ├── easings.ts             # shared cubic-bezier constants and durations
  ├── presets.ts             # shared variants: fadeUp, fadeUpStagger, crossfade
  └── README.md              # cheatsheet for which preset to use where

src/components/motion/
  ├── RevealOnView.tsx       # client; whileInView once with margin -15%; takes preset
  ├── Stagger.tsx            # client; container variant, propagates stagger to children
  ├── CountUp.tsx            # client; animates a motion value to a target on whileInView (used by PainResonance "14 unread" only)
  └── ScrollProgress.tsx     # client; useScroll hairline strip, fixed top
```

**Pattern.** Sections stay server components. Inside each section, wrap rows or blocks with `<RevealOnView>` (a tiny client component). This keeps the marketing tree mostly RSC; only the motion-bearing leaves are client.

**LazyMotion.** Use `domAnimation` features (drag, layout, gestures, exit) but not `domMax` (skips path morphing we do not need). Saves ~15kb vs full bundle.

**MotionConfig.** Mount once at the `(public)/layout.tsx` level with `reducedMotion="user"` and a default `transition={{ duration: 0.7, ease: easeOutExpo }}`.

## Per-section plan

### 0. Foundation (cross-page)

- Install `motion`. Add `MotionRoot` to `src/app/(public)/layout.tsx`.
- `ScrollProgress`: 1px hairline strip pinned top of viewport, coral colour, scaleX bound to `useScroll().scrollYProgress`. Hidden on `prefers-reduced-motion`.
- `PublicNav`: on scroll past 80px, fade in a `bg-cream/85 backdrop-blur-md` background + 1px ink/10 bottom border. This is one of the three sanctioned glass surfaces (designsystem.md §4.16, sticky chrome).

### 1. Hero (`Hero.tsx`)

- Headline word-by-word reveal on mount. Wrap each word of "Your crew's trip, fully planned." in `motion.span` with stagger. Per-word: `opacity 0 to 1`, `y 14px to 0`, `filter blur(8px) to blur(0)`. 80ms stagger. 0.7s duration. Italic "finally" in the subhead gets the same treatment, delayed.
- Background coral radial: very gentle parallax via `useScroll` + `useTransform` mapping `scrollY 0 to 600` to `y 0 to -60`. Cuts on reduced motion.
- Featured-trip card: `whileInView` lift. From `opacity 0, y 32` to rest. Once.
- Card hero image: 8s Ken Burns. `scale 1 to 1.04`, `transition: { duration: 8, ease: "linear", repeat: Infinity, repeatType: "mirror" }`. Pauses on reduced motion.
- "Live · curated" pulse dot: keep CSS pulse, add a subtle motion ring on first mount (one-shot scale-out fade-out).
- Primary CTA: `whileHover` arrow `x: 4`, no scale. 0.18s.
- Anchor jump "↓ See a curated plan" gets `scroll-behavior: smooth` honored.

### 2. PainResonance (`PainResonance.tsx`)

- Section header: `RevealOnView fadeUp`.
- Chat bubbles type in sequentially when section enters viewport. Use `Stagger` container with 320ms child delay to mimic a real chat cadence (not 80ms; this is the one place we lean into pacing). Each bubble: opacity, y 8px, scale 0.98 to 1. Avatar appears 80ms before its bubble.
- "14 unread · last seen Tue" counter: `CountUp` from 0 to 14, 1.2s, ease-out. Triggers when chat header enters view.
- "No new messages for 14 days." line: fades in last, after a 600ms beat. The whole sequence reads as "watch the chat die in real time."
- Diagnosis side: `fadeUp` for the headline; "who's booking?" italic gets a separate 100ms-later reveal so the punchline lands on its own.

### 3. HowItWorks (`HowItWorks.tsx`)

- Each `<li>` step: `RevealOnView fadeUp` with 90ms stagger between rows.
- The coral border-left accent on each step: animate `scaleY 0 to 1` from top, 0.6s, on viewport-in. Origin top.
- Step numbers "01.0 / 02.0 / 03.0" stay static. (Avoid count-up here; it competes with the chat counter and weakens the device.)

### 4. DepartureBoard (`DepartureBoard.tsx`) [biggest win]

- Replace the existing `motion-safe:animate-tc-fade` CSS keyframe with `AnimatePresence mode="wait"` + `key={trip.slug}` on the FeatureCard image.
- Crossfade: outgoing `opacity 1 to 0`, incoming `opacity 0 to 1, scale 1.02 to 1`. 0.7s, eased.
- Image Ken Burns inside the active slide: 12s slow scale 1 to 1.05, mirror.
- PeekCard: parallax. As the section scrolls past, peek image translates `y 0 to -40` via `useScroll` with `offset: ["start end", "end start"]`. Reads as "the next trip is already here."
- Arrow buttons: `whileHover` border-color transition retained, plus arrow glyph `x: ±3`. `whileTap` x: ±5 for haptic feedback.
- Drag-to-advance on touch. `motion.div` with `drag="x"`, `dragConstraints` zeroed (no actual displacement persisted), `dragElastic={0.1}`. On `onDragEnd`, advance if velocity > 300px/s OR offset > 80px. Constrained to x-axis so vertical page scroll is never blocked. Mouse drag enabled too on desktop for parity.
- Trip text block (city, tagline, spec strip) restagger on slide change: same `AnimatePresence` parent, 60ms stagger, 0.5s duration.

### 5. FeatureShowcase (`FeatureShowcase.tsx`)

- Six tiles: `Stagger` grid, 70ms delta, `fadeUp` per tile. Triggers once when grid enters viewport.
- Per-tile hover: very subtle. The tile's bottom-rule (the `border-t border-ink/15` above the proof line) animates `scaleX 0 to 1` from left on hover. No background change, no shadow.
- "Founding only" badge: `RevealOnView` with a 200ms delay after its parent tile, so it lands as a final beat on tile 06.

### 6. PricingReveal (`PricingReveal.tsx`)

- Three columns rise in with 120ms stagger. `fadeUp` 24px.
- "Most crews pick" chip on Crew Plus: scales in from 0.9 with a 200ms delay after column lands. This is the only place the chip's existing badge gets an animation, so it pulls focus naturally.
- Bullet list: per-bullet 50ms stagger fade-in after column lands.
- Prices stay static. Considered count-ups; rejected. The serif weight on £9 / £179 is doing the work; animating digits competes with that gravity and reads as SaaS-template.

### 7. FAQ (`FAQ.tsx`) [deferred to follow-up PR]

Out of scope for this PR. The FAQ rewrite (replacing native `<details>` with a controlled accordion to enable smooth height animation) is structurally different from the rest of the work: it touches crawler-visible markup and a11y wiring rather than wrapping existing markup with motion primitives. It gets its own focused PR with SEO + screen-reader verification.

In this PR, the only FAQ change is: sticky left column ("Five questions, before you apply.") gets a `RevealOnView` on first scroll-in. The `<details>` accordion stays as-is.

### 8. PublicNav (`PublicNav.tsx`)

- See foundation. Backdrop-blur fade-in past scroll threshold.
- Mobile menu (if any open): `AnimatePresence` for the panel, slide-down + fade.

## Data flow and state

- No new server state. All motion is client-only.
- `useScroll` is shared via `MotionConfig`'s default container (window). No prop drilling.
- `useReducedMotion()` checked once in `MotionRoot`; passed down implicitly via `MotionConfig`.

## Accessibility

- `prefers-reduced-motion: reduce` strips all transforms via MotionConfig. Opacity-only fallback retained for entrances. Count-ups jump to final value. Ken Burns and parallax disabled.
- Focus rings unchanged. No motion on `:focus-visible`.
- All `whileInView` blocks pass `viewport={{ once: true, margin: "-15% 0px" }}` so screen readers do not re-trigger reveals on scroll-back.
- FAQ panels keep `aria-expanded` on the trigger and `aria-controls` linking to the panel id.
- Drag affordance on DepartureBoard (if shipped) keeps the existing arrow buttons as the primary control. Drag is enhancement.

## Testing

- Add to `tests/landing-content-guards.spec.ts`: assert reduced-motion path renders all hero text immediately (no opacity 0 stuck states) when emulating `prefers-reduced-motion`.
- Add `tests/e2e/landing-motion.spec.ts`:
  - Smoke: page loads, hero headline visible within 1.5s.
  - Reduced motion: emulate, assert FAQ panel toggles open without animation, assert scroll progress strip not present.
  - DepartureBoard: click next, assert active slide changes, no flash of empty card.
- a11y sweep: keep existing axe coverage green. New keyboard tests for FAQ controlled component.

## Phasing

Independent phases. Each can ship on its own and is a standalone commit.

| Phase | Scope | Rationale |
|------|------|-----------|
| 1 | Foundation: install `motion`, MotionRoot, easings/presets, ScrollProgress, RevealOnView, Stagger, CountUp, PublicNav blur on scroll | Unlocks all later phases. Lowest visual risk. |
| 2 | Hero | Highest visual return. Sets the tone. |
| 3 | Section reveals: PainResonance, HowItWorks, FeatureShowcase, PricingReveal | Pure additive. Each section independent. |
| 4 | DepartureBoard upgrade (crossfade, parallax, Ken Burns, drag-to-advance) | Largest behaviour change. Test thoroughly on mobile Safari. |
| 5 | QA pass: Playwright reduced-motion + mobile thumbprint, Lighthouse perf check | Final gate. |

FAQ accordion rewrite is a separate follow-up PR (see §7). Reasoning: it replaces a working semantic HTML primitive with a custom controlled component, which has different failure modes (SEO indexing, screen-reader handling, mobile native long-press) than the additive motion work in phases 1 to 4. Splitting keeps each PR's blast radius scoped to one concern and each revert clean.

## Risks and footguns

- **"use client" creep.** Using `motion.div` directly in section files would force the whole section client. The `RevealOnView` wrapper pattern is mandatory; do not import from `motion/react` directly inside section files.
- **FAQ SEO regression.** If we conditionally render the panel, crawlers lose the content. Keep it always-rendered; collapse via height.
- **Stagger compounding on slow devices.** A 70ms stagger across 6 tiles is fine. Resist the urge to nest stagger containers (e.g., column stagger + bullet stagger triggering simultaneously); cascade them with a top-level delay instead.
- **Ken Burns competing with parallax.** Hero has both; verify mobile Safari does not jank. If it does, drop Ken Burns, keep parallax.
- **DepartureBoard drag.** Touch-only enhancement. Do not let it interfere with vertical page scroll on mobile. Constrain to `drag="x"` with `dragElastic={0.1}`.
- **Codex collision.** Skip phases that touch files Codex is likely editing. Phase 1 and 2 are safe (new files + Hero). Coordinate before starting phase 3 if Codex is in PainResonance/PricingReveal.

## Decisions log (resolved 2026-04-28)

1. **Drag-to-advance on DepartureBoard**: ship in phase 4. Mouse and touch.
2. **Hero coral parallax**: ship. Subtle, additive, does not break brutalist baseline.
3. **PricingReveal count-ups**: dropped. Serif weight on £9 / £179 carries the price; animating digits competes and reads SaaS-template.
4. **FAQ accordion rewrite**: split out to a follow-up PR. Different risk profile from the additive motion work.
