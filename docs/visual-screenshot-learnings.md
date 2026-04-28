# Visual Screenshot Learnings

Date: 2026-04-28

These notes summarize the temporary screenshots captured during the landing, curated teaser, and pricing/account work. The image files were used as local review artifacts only; the durable output is this checklist.

## Screenshots Reviewed

Root-level review artifacts:

- `v2-hero.png`
- `v2-hero-after.png`
- `v2-pricing.png`
- `v2-pricing-after.png`
- `apply-form.png`
- `curated-bali-full.png`
- `curated-bali-header-after.png`
- `curated-bali-apply-after.png`

Playwright MCP captures:

- `.playwright-mcp/01-hero-above-fold.png`
- `.playwright-mcp/02-hero-trip-card.png`
- `.playwright-mcp/03-curated-hero.png`
- `.playwright-mcp/04-curated-full.png`
- `.playwright-mcp/05-landing-full.png`
- `.playwright-mcp/06-hero-final.png`
- `.playwright-mcp/07-apply-form.png`
- `.playwright-mcp/08-mobile-hero.png`
- `.playwright-mcp/09-mobile-curated-mallorca.png`
- `.playwright-mcp/10-hero-new-copy.png`
- `.playwright-mcp/11-hero-finally.png`
- `.playwright-mcp/12-hero-finally-underline.png`
- `.playwright-mcp/v2-01-fullpage.png`
- `.playwright-mcp/v2-curated.png`
- `.playwright-mcp/v2-fix-howitworks.png`
- `.playwright-mcp/v2-footer.png`
- `.playwright-mcp/v2-howitworks.png`
- `.playwright-mcp/v2-pain.png`
- `.playwright-mcp/v2-pricing.png`
- `.playwright-mcp/v2-pricing-fixed.png`

## Useful Findings

- Hero copy changes are visually meaningful even when layout does not move. The shift from "Apply to plan your version" to "Apply for an invite" made the invite-only model clearer without changing the composition. Future CTA copy changes should get a quick screenshot pass, not only text tests.
- The first viewport successfully signals the product: brand, invite-only context, primary CTA, and a visible hint of the curated plan below the fold. Preserve that "next section peeking in" behavior when changing hero height or nav spacing.
- Pricing badges need truth checks. "500 of 500 seats remain" looked like a fake scarcity claim; "Founding cohort - 500 seats" was more honest while still communicating the cap. Future scarcity labels should be validated against the live data semantics before shipping.
- The application form reads cleanly at desktop width, with predictable vertical rhythm and no nested cards. The heading "Tell us about your crew." also matches the current application-flow test and should remain the anchor for that page.
- Curated trip pages need both header and deep-page captures. The Bali header looked strong above the fold, but the conversion CTA and lower plan sections carried different risk: CTA wording, long black-band spacing, and table row overflow only show up in deeper captures.
- The curated Bali full-page screenshot exposed a likely future design risk: image-backed hero sections look premium, while later framed data blocks can feel sparse if media placeholders are empty. When adding real accommodation or activity images, verify the same page again.
- The fixed nav is useful for orientation across long pages, but it can make top-cropped screenshots misleading. For future reviews, capture both full page and targeted section screenshots so we know whether a crop is a viewport artifact or a layout issue.
- Full-page landing captures are better than section-only captures for rhythm. The v1 full-page pass showed several heavy bordered sections stacked with similar weight; the v2 pass improved this by giving the pain, steps, board, feature grid, pricing, FAQ, and footer more distinct section rhythms.
- Mobile screenshots are mandatory for this visual system. The mobile hero still worked because the headline stayed large and the curated plan peek remained visible, but CTA copy and line breaks changed the perceived promise more dramatically on mobile than desktop.
- Curated mobile pages need special attention around hero photo crop and stats grid. The Mallorca capture kept the destination legible and the 2x2 stats grid readable; this should be the baseline for every curated destination template.
- The pain section became much stronger when the chat artifact and statistic shared the same viewport. Earlier full-page rhythm made the section feel like another card; the later capture reads as a diagnosis with proof.
- The How It Works section improved when it stopped looking like three equal cards and became a sequence of editorial rows. For this brand, process steps should feel like an operating method, not SaaS feature cards.
- Footer and FAQ captures show the bottom of the page is carrying a lot of trust weight. Do not treat the footer as boilerplate; it is where legal links, contact, and final brand tone all become visible.
- The intermediate hero captures are useful because they show that underline/italic experiments can quickly distract from the core promise. Keep the hero sentence typographically restrained and let motion or the curated-plan preview provide the extra emphasis.
- Pricing iteration captures proved that amount and billing cadence must be reviewed together. A wrong founding cadence (`£15/mo`) looked visually plausible, which means screenshot review must be paired with pricing-doc checks.
- The small lower-left local widget appears in captures and should be ignored for product layout decisions unless it overlaps core UI. It is not part of Tripcrew's public surface.

## Future Screenshot Checklist

- Capture desktop hero, pricing, application form, curated header, and curated CTA sections after copy changes.
- Capture at least one mobile viewport for landing and curated pages before launch.
- Capture one full-page landing screenshot after section-layout changes, then scan for repeated visual weight between adjacent sections.
- Capture both current and previous pricing states when changing prices, billing cadence, seat caps, or scarcity language.
- Capture a curated destination on mobile whenever the hero image, stat grid, or CTA band changes.
- Treat pricing/scarcity labels as data contracts, not just design text.
- Keep temporary PNGs out of commits unless a visual regression fixture explicitly needs them.
