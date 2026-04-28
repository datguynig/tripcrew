# Visual Screenshot Learnings

Date: 2026-04-28

These notes summarize the temporary root-level screenshots captured during the landing, curated teaser, and pricing/account work. The image files were used as local review artifacts only; the durable output is this checklist.

## Screenshots Reviewed

- `v2-hero.png`
- `v2-hero-after.png`
- `v2-pricing.png`
- `v2-pricing-after.png`
- `apply-form.png`
- `curated-bali-full.png`
- `curated-bali-header-after.png`
- `curated-bali-apply-after.png`

## Useful Findings

- Hero copy changes are visually meaningful even when layout does not move. The shift from "Apply to plan your version" to "Apply for an invite" made the invite-only model clearer without changing the composition. Future CTA copy changes should get a quick screenshot pass, not only text tests.
- The first viewport successfully signals the product: brand, invite-only context, primary CTA, and a visible hint of the curated plan below the fold. Preserve that "next section peeking in" behavior when changing hero height or nav spacing.
- Pricing badges need truth checks. "500 of 500 seats remain" looked like a fake scarcity claim; "Founding cohort - 500 seats" was more honest while still communicating the cap. Future scarcity labels should be validated against the live data semantics before shipping.
- The application form reads cleanly at desktop width, with predictable vertical rhythm and no nested cards. The heading "Tell us about your crew." also matches the current application-flow test and should remain the anchor for that page.
- Curated trip pages need both header and deep-page captures. The Bali header looked strong above the fold, but the conversion CTA and lower plan sections carried different risk: CTA wording, long black-band spacing, and table row overflow only show up in deeper captures.
- The curated Bali full-page screenshot exposed a likely future design risk: image-backed hero sections look premium, while later framed data blocks can feel sparse if media placeholders are empty. When adding real accommodation or activity images, verify the same page again.
- The fixed nav is useful for orientation across long pages, but it can make top-cropped screenshots misleading. For future reviews, capture both full page and targeted section screenshots so we know whether a crop is a viewport artifact or a layout issue.
- The small lower-left local widget appears in captures and should be ignored for product layout decisions unless it overlaps core UI. It is not part of Tripcrew's public surface.

## Future Screenshot Checklist

- Capture desktop hero, pricing, application form, curated header, and curated CTA sections after copy changes.
- Capture at least one mobile viewport for landing and curated pages before launch.
- Treat pricing/scarcity labels as data contracts, not just design text.
- Keep temporary PNGs out of commits unless a visual regression fixture explicitly needs them.
