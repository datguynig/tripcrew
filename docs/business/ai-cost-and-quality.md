# AI Cost And Quality Playbook

Last updated: 2026-04-28

Tripcrew's paid value depends on AI output feeling specific, grounded, and useful enough that the organiser trusts the plan. This doc defines the cost controls and quality checks around that promise.

## AI Surfaces

Current and planned AI surfaces:

- Lock & Draft after a destination is locked.
- Per-candidate basic drafts before lock for paid users.
- Curated trip personalized teaser.
- Future conversational AI planning.
- Future cross-trip memory and during-trip AI.

## Current Pipeline

Lock & Draft combines:

- Saved trip preferences: origin, crew size, budget, vibes, occasion, notes, and pinned moments.
- Gemini structured generation.
- Google Places enrichment for real-world specificity.
- Persisted outputs on the trip: enriched draft, tier, generated timestamp, hero/brief/schedule/activity/booking data.
- Usage telemetry in `ai_usage`.

## Cost Controls

Keep these invariants:

- Paid tier gates expensive generation.
- Free tier should not receive the same expensive structured output as paid tiers.
- Google Places field masks stay tight.
- Places calls should be deliberate and tied to visible plan value.
- Draft regeneration should be capped or justified by a stale-brief state.
- Curated teaser has per-IP or equivalent abuse limits.
- Every paid generation path should log usage telemetry.

## Quality Bar

A paid draft should:

- Reflect the user's origin, dates, crew size, budget, vibes, occasion, and pinned moments.
- Name specific places or areas only when supported by Places or curated seed data.
- Produce a coherent day-by-day shape, not a generic travel essay.
- Help the admin make booking decisions.
- Produce structured data that the overview can render without manual cleanup.
- Avoid unsafe certainty about live prices, availability, and events unless sourced.

## Founder Review Rubric

Score sample drafts 1-5 on:

- Specificity: does it feel like this crew and this trip?
- Usefulness: can the organiser act on it?
- Taste: does it match the brand and avoid generic AI travel voice?
- Grounding: are places, prices, and claims plausible and bounded?
- Edit burden: how much would the organiser need to fix?
- Cost/value: was the run worth the API cost?

## Incident Triggers

Investigate immediately when:

- Draft generation fails for a paid user.
- Drafts are generic despite rich preferences.
- Places cost increases without a corresponding quality improvement.
- The model returns invalid structured output.
- The same curated teaser is generated repeatedly by one visitor/IP.
- AI copy makes unsupported claims about bookings, prices, safety, or availability.

## Operational Checks

Weekly during launch:

- Review total AI spend.
- Review average cost per successful Lock & Draft.
- Review failure rate by surface.
- Read a sample of generated drafts from new paid users.
- Compare applicant pain points to generated plan content.
- Capture recurring misses as prompt/schema changes, not one-off manual fixes.

## Roadmap Implications

Future Founding Crew AI promises increase both cost and trust obligations:

- Conversational AI adds repeated model calls and memory management.
- Cross-trip memory requires careful data boundaries and user expectations.
- During-trip AI requires mobile context and location/privacy decisions.
- Price-drop and event alerts require scheduled jobs and reliable source attribution.

Do not market these as available until each has an implemented surface, cost model, and support playbook.
