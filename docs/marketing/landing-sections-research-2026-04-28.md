# Landing sections research — 2026-04-28

Body and footer of the invite-only landing page. Reference sites visited at 1440px viewport. Screenshots in `/Users/nigel/Claude/tripcrew/research/`.

Aesthetic constraints honoured: editorial-brutalist (cream, ink, coral; mono caps; serif display; 2px hard borders; no gradients; no rounded-card chrome; no emoji; no competitor names in recommended copy).

---

## 1. PainResonance

References: Mercury, Notion, Pitch, Gusto.

### Patterns common to premium versions

- **The pain is named in the section heading itself, not buried in body copy.** Mercury: "Banking's been a headache. Now, it's a head start." (`painresonance-mercury.png`). The headline does the entire emotional lift; the artefact below supplies proof.
- **One artefact, not five.** Notion's product pages centre a single database render inside an empty cream panel (`painresonance-notion-2.png`). The white-space around it is what makes it feel premium.
- **Stats are paired with the artefact, never freestanding.** Gusto's Forbes / Newsweek / CNBC bar (`painresonance-gusto.png`) sits directly under the product visual. Stats anchored to a visible truth read as evidence.

### Anti-patterns to avoid

- More than two statistics in the same eyeful. Three or more stats fight each other.
- Italicised "twist" closer asking the reader to feel sad. Premium operators state the situation; they do not write a short story about it.
- Stock-portrait avatars on the fake chat mockup. Generic faces pull the eye toward "who are these strangers" instead of the missed-trip beat.

### Recommendations for Yenkoh

- **Promote the closer to the headline.** Cut "Three months later, no one went." entirely. Rewrite as a Mercury-style two-beat: "Six friends. One chat. No trip ever leaves it." The artefact below is then just the receipt. Reference: `painresonance-mercury.png`.
- **Drop one of the two stats.** Keep the trip-specific one ("1 in 5 friend trips ends a friendship over money"). The 73% affordability stat is generic SaaS-research bait. Single anchored stat reads as conviction. Reference: `painresonance-mercury.png` (Mercury cites zero stats and is more authoritative for it).
- **Replace avatar photos with mono-cap initials in coral squares.** "JM", "TS" in 2px-bordered coral squares sidestep the stock-photo problem and reinforce the design system.
- **Compress the chat to 2 messages plus the read-receipt bar.** Five reads as a meme; two plus "no new messages for 14 days" delivers the same emotional beat in half the real estate. Reference: `painresonance-notion-2.png`.

### Single most powerful idea worth stealing

**Mercury's pain-then-relief one-liner is the entire section.** Compress the headline + artefact + 2 stats + italic closer into one line and let the artefact breathe.

---

## 2. HowItWorks

References: Linear (versioned section markers), Framer (sticky stacked steps), Loom, Cron.

### Patterns common to premium versions

- **Versioned numbers, not ordinals.** Linear uses `2.1`, `2.2`, `2.3`, `3.0` as section markers (`howitworks-linear.png`). Frames each step as a release line. Ordinals 01 / 02 / 03 are common; dot-version numbering is rare and reads built-by-an-engineer.
- **Each step is a complete unit: number, verb, body, concrete artefact.** Framer's stack (`howitworks-framer-2.png`) gives each step its own paragraph, learn-more link, and product render. Steps without a visual feel like agenda items.
- **Step number smaller than the verb.** Both set the index in mono caps at 12–14px while the section title runs 48–80px serif. Reverse that and it reads as an onboarding wireframe.

### Anti-patterns to avoid

- Three identical-weight cells in a strict thirds grid. Reads as a wireframe placeholder.
- Identical body length across all three steps. Premium sites accept asymmetry; step 02 is usually longer because that is where the product actually does its work.
- A header listing the steps verbally ("Three steps...") *and* numbered cells beneath. Pick one.

### Recommendations for Yenkoh

- **Adopt Linear's versioned numbering.** Replace `01 / 02 / 03` with `01.0 Apply`, `02.0 Lock`, `03.0 Land`. The dot-version makes the surface feel like a software changelog. Reference: `howitworks-linear.png`.
- **Drop the "Three steps. One trip out the door." header.** Redundant with the numbered cells beneath. Linear and Framer never narrate their own structure. Reference: `howitworks-framer-2.png`.
- **Use the spare vertical real estate for a per-step micro-artefact.** A one-line group-chat extract for Apply, a polaroid stack thumbnail for Lock, a flap-tile fragment for Land. Reference: `howitworks-framer-2.png`.
- **Allow asymmetric body length.** Step 02 (Lock) is the moment of value; give it 2–3 lines while Apply and Land sit at one each.

### Single most powerful idea worth stealing

**Section markers as software version numbers.** "01 / 02 / 03" is a wireframe; "01.0 / 02.0 / 03.0" is a roadmap. Free editorial brutalism. Instantly distinctive.

---

## 3. DepartureBoard

References: Apple iPhone variant carousel, Linear customers grid, Vercel templates grid.

### Patterns common to premium versions

- **One hero up front, peers peeking from the right edge.** Apple iPhone (`departureboard-apple.png`) shows iPhone 17 Pro fully + iPhone Air + iPhone 17 + iPhone 16e cropped at the right edge. The peek tells the eye "more exists" without a clumsy "1 of 5" indicator.
- **Per-card structure: image, name, single tagline, one numeric anchor, two CTAs.** Apple ships exactly that. Two CTAs is the maximum; more reads as a brochure.
- **Color or state dots beneath the image, not under the title.** Apple's tiny variant dots sit between hero image and product name. They communicate options without committing to a tab strip.

### Anti-patterns to avoid

- 5-thumbnail tablist below the hero. It works as nav but pre-commits the user to the carousel format and screams "rotator." Premium versions hide the mechanism.
- 5.5-second auto-advance. Anything moving on its own past ~7s feels like a slot machine. Apple's carousel only advances on click.
- Generic prev / next arrows centered under the image. Apple right-aligns them in a separate row, never centered.

### Recommendations for Yenkoh

- **Replace the 5-thumbnail tablist with a peek pattern.** Show trip 1 fully, trip 2 cropped at right edge by ~30%. Add right-aligned prev / next chevrons. The flap-tile animation can stay as the on-card reveal, separate from the carousel mechanism. Reference: `departureboard-apple.png`.
- **Kill the 5.5s auto-rotate.** Replace with click-only advance. If you want motion, animate the flap-tile board only on first scroll-into-view. Reference: `departureboard-apple.png`.
- **Tighten card structure to: photo, destination name, one-line vibe, per-head price, two CTAs.** Currently the flap-tile tries to render destination + dates + per-head + vibes simultaneously, which is four things. Reduce on-card text to destination + vibe + price; let dates appear in the brief. Reference: `departureboard-apple.png`.
- **Add small coral dots between trip image and trip name to indicate available departures.** Three coral dots = three departure dates available; hollow circle = sold out. Reuses Apple's variant-dot pattern in a Yenkoh-native way.

### Single most powerful idea worth stealing

**Hide the rotator mechanism, let the next card peek.** A 30% crop of trip N+1 at the right edge does more for premium feel than any tablist of thumbnails will, because it makes the showcase feel like an editorial spread instead of a JS widget.

---

## 4. FeatureShowcase

References: Attio platform showcase, Vercel features grid, Linear features grid.

### Patterns common to premium versions

- **Each tile renders an actual UI fragment, not an icon.** Attio shows real lead-scoring panels (`featureshowcase-attio-2.png`). Linear shows real issue cards (`featureshowcase-linear.png`). Vercel shows real model leaderboards (`featureshowcase-vercel.png`). Stock icons are absent. Premium feature grids prove the feature with a fragment of the actual product.
- **2-column grid, not 3.** Linear and Attio break their feature panels into 2 columns at 1440px. Three columns force tile body copy to ~50 chars per line, which crushes any product-render headroom.
- **Mono-cap label sits above the serif title.** Vercel: "Fluid Compute" mono-cap label, then "A compute model for all workloads." serif title (`featureshowcase-vercel.png`). The mono cap is the column header; the serif is the proposition. Yenkoh tiles already do this. Keep it.

### Anti-patterns to avoid

- 3-column grid at 1440px when each tile carries product visual + 4 lines of text + proof line. It overflows. Reduce to 2-col or strip body copy aggressively.
- Identical chrome on every tile. Linear lets one tile run a static screenshot, another a kanban render, another a phone mockup. Heterogeneity inside a homogenous grid is what makes it feel hand-built.
- Tile 06 with a "Founding only" badge inside a 3-col grid where it is just one of six. Premium versions either feature the gated tile (full-width, last position) or remove it from the grid.

### Recommendations for Yenkoh

- **Drop from 3-col to 2-col.** Six tiles becomes three rows of two. Each tile gets ~50% more horizontal real estate, enough for a small product render. Reference: `featureshowcase-linear.png`.
- **Render a tiny product fragment per tile, replacing the proof line.** A 3-message feed snippet for "The vote", a polaroid stack thumbnail for "The plan", a mini ledger row for the ledger feature. Currently the tiles are pure typography; premium versions are typography plus a fragment. References: `featureshowcase-attio-2.png`, `featureshowcase-vercel.png`.
- **Promote tile 06 (Founding only) to full-width, last position, below the 2-col grid.** Treat it as a section coda rather than just one tile of six. Coral 2px border, larger serif, centered. Reference: `featureshowcase-linear.png`.
- **Standardise the index format to match HowItWorks.** Use `01.0 / 02.0 / 03.0` versioned numbering across both sections for cohesion. Reference: `howitworks-linear.png`.

### Single most powerful idea worth stealing

**Each tile must render a slice of the actual product.** Pure-typography feature tiles are a mid-2010s pattern. Every premium 2026 feature grid puts a real UI fragment inside every tile, even if the fragment is tiny. The fragment is the feature.

---

## 5. PricingReveal

References: Linear pricing, Vercel pricing, Mercury pricing, Superhuman pricing.

### Patterns common to premium versions

- **No card chrome. Just vertical hairlines between columns.** Mercury (`pricing-mercury.png`) and Linear (`pricing-linear.png`) both ship pricing without per-card backgrounds, borders, or shadows. 1px vertical dividers separate columns. The cards exist as columns of typography, not as boxes.
- **Recommended tier marked by a small chip protruding above the column, not a coloured background.** Vercel's "Popular" tab (`pricing-vercel.png`) is a black chip pinned to the top edge of the Pro column. The column itself has no special chrome.
- **Big serif price numeral, small mono-cap unit.** Superhuman ships "$33" hero-sized with "/USER /MONTH" tiny mono-cap (`pricing-superhuman.png`). Mercury similarly: "$29.90" big, "/mo." small. The number is the headline; the unit is fine print.
- **CTA above the bullets, not below.** Mercury and Superhuman both place the primary CTA right under the price, with bullets running long below. The reader knows what to click before they read the feature list.

### Anti-patterns to avoid

- 3 cards in 3 boxes with rounded corners and full backgrounds. Reads as a 2018-era SaaS template.
- Coloured background on the recommended card. Vercel does not tint Pro; Mercury does not tint Plus; Linear does not tint anything. The chip does the work; let the typography stay calm.
- Counter ("X / 500 left") treated as a bullet. The Founding scarcity counter deserves its own line in mono caps below the price, not buried in the feature list.

### Recommendations for Yenkoh

- **Strip card chrome.** Replace the 3 boxed cards with 3 columns of typography on the bg-ink panel separated by 1px dividers. Each column = tier name, tagline, serif price, period, CTA, bullets. No card border, no background tint. References: `pricing-linear.png`, `pricing-mercury.png`.
- **Mark Pioneer with a coral mono-cap chip pinned to the top edge of its column.** Text: "234 / 500 LEFT". Move the counter from inside the card to this chip. Reference: `pricing-vercel.png`.
- **Move CTAs above the bullet list.** Flip to: tier, tagline, price, CTA, bullets. The CTA earns attention while the price is still in view. References: `pricing-mercury.png`, `pricing-superhuman.png`.
- **Set the price numeral at hero scale (~96 to 120px serif) with the period mono-cap small below.** "£79" giant, "/YEAR" tiny mono-cap underneath. Currently the price reads as body text; premium versions make the number itself the visual anchor. Reference: `pricing-superhuman.png`.

### Single most powerful idea worth stealing

**Vertical hairlines replace cards.** The boxed-card pricing pattern signals "marketing template." Three columns of pure typography on dark ink, separated by 1px dividers, signals "we sweat the type." It is also strictly more on-brand for editorial brutalism than any boxed alternative.

---

## 6. FAQ

References: Stripe pricing FAQ, Vercel pricing FAQ.

### Patterns common to premium versions

- **2-column layout: section heading sticky-left, accordion stacked-right.** Vercel (`faq-vercel.png`) anchors a giant serif "Frequently asked questions." in the left column and lets the accordion run down the right. The heading stays visible as the user opens / closes rows.
- **Hairline-separated rows with no card borders.** Stripe (`faq-stripe-3.png`) uses a flat full-width list with thin gray rules between rows. No per-row chrome. Premium FAQs feel like a table of contents, not a stack of cards.
- **Chevron-down rotating to chevron-up on open, not "+/×".** Stripe and Vercel both use a chevron, not a plus sign. Plus rotating to × is fine but reads "FAQ widget"; chevron rotating 180° reads "table of contents."

### Anti-patterns to avoid

- Centered single-column accordion with the heading floating above. It works but it is the default. Nothing distinctive.
- Coloured filled chevron circle. Stripe's filled-circle chevron is fine on their lavender brand but it draws the eye to the chevron rather than the question. Editorial brutalism wants the chevron unfilled.
- "Still have questions? hello@yenkoh.com" presented as a pleasantry. Stripe phrases the closer as a CTA: "Ready to get started? Get in touch or create an account." Active voice + one direct command beats a polite question.

### Recommendations for Yenkoh

- **Restructure to 2-column: sticky heading-left, accordion-right.** Left column (~30% width) holds "Frequently asked questions." in serif at 64–72px. Right column (~70%) holds the 5 rows. Reference: `faq-vercel.png`.
- **Replace coral "+" chevron with an unfilled 2px coral chevron-down that rotates 180° on open.** The current "+" rotating 45° is borderline-cute. Reference: `faq-stripe-3.png`.
- **Drop card chrome from each row.** 2px ink-2 hairline above and below; no per-row border. Question label in serif at ~20–24px, answer in body weight beneath. Reference: `faq-stripe-3.png`.
- **Rewrite the closer from "Still have questions? hello@yenkoh.com" to a three-word imperative.** Try "More to ask. → hello@yenkoh.com". Active voice signals confidence; the polite question deflates the section.

### Single most powerful idea worth stealing

**Sticky FAQ heading on the left, accordion on the right.** This single move turns the section from "list of Q&A" into "FAQ as table of contents." The heading anchors the reader; the questions feel browsable rather than sequential.

---

## 7. Footer

References: Apple footer, Linear footer, Mercury footer, Stripe footer.

### Patterns common to premium versions

- **Restraint over density on premium SaaS; density on consumer.** Linear (`footer-linear.png`) ships only 5 link columns + small wordmark + Privacy / Terms / DPA in a single sub-row. Apple (`footer-apple.png`) ships 6 columns of dense links + Apple Pay legalese + locale. Linear is the right reference for Yenkoh's premium B2C tone.
- **Mono-cap dim category labels above each link column.** Linear, Mercury (`footer-mercury.png`), and Stripe (`footer-stripe.png`) all use small caps in dimmed white / ink for category headers. Same mono-cap typography as the rest of the page, applied at footer scale.
- **No icon-bug social row.** None of these footers feature platform icons across the bottom. Linear lists "X (Twitter), GitHub, YouTube" as plain text links inside the Connect column.
- **Bottom strip is one line: copyright, 3–5 legal links, locale (if international).** Apple: "Copyright © 2026 Apple Inc. All rights reserved. | Privacy Policy | Terms of Use | ... | United States". Single horizontal stripe, dim text, pipes between items.

### Anti-patterns to avoid

- 4 columns where the brand block has equal weight to the link columns. The brand block should be visually dominant or visually understated, never matched. Linear chooses tiny: small wordmark, no tagline, no italic.
- "Built in London" as standalone copy in the brand block. Premium operators either drop location or hide it in a status pill. Linear has no location at all.
- Status pill at the very bottom-right. Stripe and Linear do not have one. Vercel does, but it is a developer-tools necessity. For a consumer trip-planner the pill reads as B2B SaaS posturing.

### Recommendations for Yenkoh

- **Cut "Built in London" and the italic tagline from the brand block.** Replace with just the wordmark at modest scale. The italic tagline duplicates the hero; repeating it in the footer is a junior-marketer move. Reference: `footer-linear.png`.
- **Remove the "All systems good" status pill.** The current Yenkoh app has no public status page; the pill implies infrastructure SLAs that do not exist. Bottom strip becomes: copyright on the left, Privacy / Terms / Cookies pipe-separated on the right. References: `footer-apple.png`, `footer-linear.png`.
- **Tighten Product / Company / Legal columns to 5–6 links each maximum.** Stay closer to Linear's restraint than Apple's exhaustiveness; this is a 500-spot invite-only product. References: `footer-linear.png`, `footer-apple.png`.
- **Replace any social-icon bar with plain-text social links inside a "Follow" column.** "X · Instagram · Substack" as text links in mono-cap column treatment. No platform iconography. References: `footer-linear.png`, `footer-mercury.png`.

### Single most powerful idea worth stealing

**Premium footers shed signals more than they add them.** The instinct is to load the footer with status pills, location stamps, italic taglines, social icons, and feature anchors. Linear's footer does almost none of this and reads as the most premium of any in the reference set. For invite-only products the signal is: "we do not need to convince you here, you have already seen the page." Restraint is the move.

---

## Cross-cutting principles

1. **Strip chrome from cards across every section.** Pricing, FAQ, FeatureShowcase, footer: all four are improved by replacing boxed cards with hairline-separated columns of typography. The editorial-brutalist baseline already wants this; the screenshots prove premium operators ship it.
2. **A small concrete artefact beats a paragraph of copy.** PainResonance, HowItWorks, FeatureShowcase, DepartureBoard all benefit from one tiny rendered UI fragment per beat instead of body text. The fragment is the proof.
3. **Versioned section markers (`01.0`, `02.0`) are free editorial brutalism.** Use them across HowItWorks and FeatureShowcase indices. Costs nothing, instantly distinctive, reinforces the product's "built like software" tone.

---

## 8. Travel-industry references

**Visited:** Inspirato, Black Tomato, Original Travel, Audley Travel, Mindtrip (substituted in for Thatch — `thatch.co` 301-redirects to `mindtrip.ai/thatch` post-acquisition; Mindtrip is the live travel-marketplace successor and ships a "Plan with your crew" feature, so it remains a relevant reference). Captures live in `/Users/nigel/Claude/tripcrew/.playwright-mcp/research/travel-*`.

### What premium travel sites get right that SaaS sites do not

- **The hero is the place, not the product.** Inspirato's above-fold is a single full-bleed editorial photograph with one serif line floated centre (`travel-inspirato-00.png`); Black Tomato leads with an elephant herd cropped at the lens (`travel-blacktomato-00.png`); Original Travel runs a sepia, almost-cinematic still (`travel-originaltravel-00.png`). None of them show the product. SaaS hero discipline says "show the artefact." Travel hero discipline says "the place is the artefact." For an invite-only trip-planner this is the more honest opening — the user is buying access to a trip, not access to software.
- **One typographic line carries the whole hero, with italic emphasis on a single word.** Inspirato: "No Surprises. Just *Standards*." (`travel-inspirato-00.png`). Black Tomato: "THE LUXURY TRAVEL EXPERTS" — display sans, no italic, no helper copy beyond "Tailor-made trips. Award winning service. Est. 2005." Original Travel: "TRULY TAILOR-MADE HOLIDAYS / A different take on travel." (`travel-originaltravel-00.png`). The pattern: 5–7 words max, one piece of italic punctuation, no statistic, no bullet list. The hero is a magazine cover.
- **Serif body type, mono-cap structure labels, full-bleed photographic imagery.** Audley's "Suggested tours" section (`travel-audley-01.png`) and Inspirato's "Where to go — *right now*" (`travel-inspirato-01.png`) both pair a serif title with quietly-set tabs in mono-style caps. This is exactly the editorial-brutalist palette Yenkoh already uses; the travel reference set proves the type system reads premium when the imagery does the heavy lifting.
- **Press / awards strip is a load-bearing section, not a footer afterthought.** Black Tomato dedicates a full row mid-page to Robb Report, Travel + Leisure, Best of Luxury Travel Awards (`travel-blacktomato-02.png`). Original Travel parks a Condé Nast Traveler "Top Travel Specialists 2026" red disc directly on its publications cover (`travel-originaltravel-01.png`). Premium travel earns its premium claim by naming a publication; SaaS earns it with a customer logo bar. For a pre-launch invite-only product the equivalent is a "AS COVERED IN" or "IN GOOD COMPANY" row using press / podcast / accelerator marks, not Trustpilot widgets.
- **Long-form narrative copy lives below the carousel.** Black Tomato gives an unironic two-paragraph essay near the bottom: "We create bespoke luxury holidays for people who want more than just beautiful places…" (`travel-blacktomato-03.png`). It sits under the destination grid, not above it. Travel buyers want to read about taste before they read about features; the order is photographs → grid → essay → CTA, never the SaaS order of headline → bullets → screenshot.

### Travel-specific anti-patterns to avoid

- **Floating booking widgets and "Search countries, places, hotels…" inputs.** Audley (`travel-audley-00.png`) and Original Travel (`travel-originaltravel-00.png`) both embed a search bar in the hero. For an invite-only product with no instant-book inventory this would be a lie surface — there is nothing to search for and no quote to return. Yenkoh's hero is correct to keep a single application CTA.
- **Trustpilot stars and "4862 reviews" widgets.** Audley (`travel-audley-02.png`) and Black Tomato (`travel-blacktomato-01.png`) both ship live Trustpilot embeds with green stars and review counts. On a 500-spot pre-launch this is impossible (no reviews to pull) and tonally wrong (stars trade premium for popular). Replace with a single quoted line from a press body in serif, no star imagery.
- **Persistent green / teal "Enquire now" pill, callback prompts, "Call us today until 8pm".** Audley (`travel-audley-00.png`, `travel-audley-01.png`) renders a sticky green phone-callback chip and a permanent "Call us today until 8pm" string. Original Travel ships a teal "Enquire now" pill in the top-right (`travel-originaltravel-00.png`). The signal is "agency, contact us to start." Yenkoh's signal is "self-serve software, apply to join." Do not borrow the callback affordance.
- **Generic "What our clients say about us" testimonial slabs.** Both Audley (`travel-audley-02.png`) and Original Travel (`travel-originaltravel-03.png`) ship a centred-quote testimonial block with five teal stars and a "Read more client reviews" pill. Tonally it reads agency, not brand. If a quote section is needed it should be one named voice (paper + journalist, not customer) in serif italic, no stars, no pagination.

### How travel-site insights change the per-section recommendations

**1. PainResonance** — Inspirato proves that membership-led travel never names a pain at all (`travel-inspirato-00.png`); the section heading is an aspirational micro-promise ("No Surprises. Just *Standards*."). Travel-side update: keep the section, but rewrite the headline as the upgrade rather than the gripe — "Six friends. One chat. One trip that actually leaves it." Lean into the relief beat; do not write a sad story.

**2. HowItWorks** — Travel sites largely skip a numbered-steps section in favour of a destination grid + essay couplet (`travel-blacktomato-01.png`, `travel-originaltravel-02.png`). Travel-side update: keep Linear's `01.0 / 02.0 / 03.0` markers because they reinforce the "built like software" identity that distinguishes Yenkoh from agencies, but add one full-bleed photograph as the section's opening or closing pane so the page does not read like a pure product walkthrough.

**3. DepartureBoard** — Black Tomato's "Start your journey" trip cards are the single clearest reference: 5 portrait-aspect tiles, full-bleed photo, single serif label per tile, no per-card chrome, no booking widget (`travel-blacktomato-01.png`). Travel-side update: model the carousel directly on this. Also follow Original Travel's pattern of one card carrying a 2-paragraph caption while the others run a single line (`travel-originaltravel-02.png`); asymmetric depth signals "editorial spread" instead of "product grid."

**4. FeatureShowcase** — Inspirato's "300+ Private Residences / 170+ Sought-After Destinations" stat row (`travel-inspirato-01.png`) is one of the most copy-light sections on the page and reads more premium than any feature-tile grid. Travel-side update: consider replacing the 6-tile feature grid with a 4-up "by the numbers" row in mono caps — total trips planned, average crew size, average plan time saved, founding cohort cap — anchored above the more text-heavy 2-col feature panels. Travel sites prove a numeric row carries more weight than feature copy.

**5. PricingReveal** — None of the five travel sites ship a pricing table; they are quote-based. Travel-side update: reframe the pricing section as "Membership" rather than "Pricing." Borrow Inspirato's heading discipline: a single serif line ("Membership.") above the columns, no "PRICING" mono-cap label. The 234/500-left chip becomes "234 OF 500 SEATS REMAIN" — the word "seats" is the travel borrow. The page is selling a cohort, not a tier.

**6. FAQ** — Travel sites use FAQ rooms sparingly and bury them. Original Travel's footer-adjacent FAQ link is unsurfaced on the homepage entirely. Travel-side update: minor — do not enlarge the FAQ. Leave it short (5 rows, the existing recommendation) and resist the urge to add destination-specific FAQs ("Can I change destinations?", "What if my crew can't agree?") that bait the user back into uncertainty. The travel-side instinct is to soothe with editorial confidence, not with a help-centre.

**7. Footer** — Audley's and Original Travel's footers (`travel-audley-footer.png`, `travel-originaltravel-footer.png`) over-index on certifications (ABTA, IATA, ATOL, BA Preferred Partner, Wanderlust Travel Awards). Inspirato's footer (`travel-inspirato-footer.png`) does the opposite — quiet "Be the first to *know*" newsletter line, four restrained columns, single thin rule, social glyphs as iconography rather than text. Travel-side update: model the footer on Inspirato, not Audley. The newsletter capture line ("Be the first to *know*.") with italic on the verb is the move worth stealing verbatim — adapted to "Be the first to *board*." or "Be the first to *land*." or "Be the first to *crew up*." for Yenkoh's idiom.

### Single most powerful idea worth stealing from travel

**Travel sites earn their premium claim with a single full-bleed photograph and a six-word italicised headline; they never sell software, they sell taste.** Inspirato's "No Surprises. Just *Standards*." (`travel-inspirato-00.png`) is what every body-section opener wants to be. The takeaway for Yenkoh's body and footer: each section deserves a one-line, italic-emphasised, near-aphoristic title in the same register, and the artefact under it should be either a real product fragment (SaaS instinct, kept) or a real photograph from a real trip (travel instinct, added). The hybrid — software fragments paired with editorial photography under italic-emphasised serif titles — is a position no SaaS-only and no travel-only site occupies. That gap is the most defensible visual identity Yenkoh can claim.
