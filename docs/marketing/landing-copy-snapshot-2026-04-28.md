# Landing Page Copy Snapshot — 2026-04-28

This is a verbatim archive of every line of user-facing copy on the public landing page as of the v2 redesign (round 2). Saved before the ICP-driven copy audit so we can revert if changes stray too far.

If you ever want to revert: this is the source of truth. Copy strings back into the components listed in the parentheticals below.

---

## Browser tab title (`src/app/(public)/layout.tsx`)

```
Tripcrew. Trips that make it out of the group chat.
```

Description: `Invite-only group trip planner. Pick a city. Pull your crew. Make memories, not just wishes.`

---

## Public Nav (`src/components/marketing/PublicNav.tsx`)

- Wordmark: `Tripcrew`
- Nav links: `How it works · Sample trips · Features · Pricing · FAQ`
- Right side: `Sign in` / `Apply for invite`
- Mobile menu CTAs: `Apply for invite` / `Already have an invite? Sign in`

---

## Hero (`src/components/marketing/Hero.tsx`)

**Cohort badge:**
- `Cohort 01 · invite only`
- `Founding crew` / `{X} / 500 claimed`
- `{N} on the waitlist` (when applicants > 0)

**Headline:** `Trips that make it` / `out of the group chat.`

**Sub:** `Pick a city. Pull your crew. The plan writes itself. Bookings, ledger, chat. All in one place.`

**Form:**
- Placeholder: `your@email.com`
- Submit: `Apply for invite →`
- Microcopy: `4 questions. 90 seconds. Approved in batches.`
- Sign-in link: `Have an invite? Enter →`

---

## PainResonance (`src/components/marketing/PainResonance.tsx`)

**Kicker:** `You've had this exact chat`

**Headline:** `Six friends. One chat. No trip.`

**Sub:** `Group trips don't die because no one wants to go. They die in the chat. The vibe-check loop. The deferred decision. The price shock. The first polite drop-out. We've all been here.`

**Chat header:**
- Title: `June trip · 6 people`
- Subtitle: `14 unread · last seen Tue`
- Right tag: `Group chat`

**Chat messages (in order):**
1. Nia · Mon 19:42 — `anyone free in june`
2. Sam · Mon 19:48 — `depends on dates tbh`
3. Mo · Tue 09:11 — `max £400 fwiw`
4. Tom · Wed 22:17 — `flights have doubled lol`
5. Ash · Sat 11:03 — `actually might bow out, niece's christening`
6. Priya · Two weeks later — `…` (muted)

**Closer:** `Three months later, no one went.`
**Transition:** `Tripcrew turns the chat into a trip.`
**CTA:** `Apply for an invite →`

---

## HowItWorks (`src/components/marketing/HowItWorks.tsx`)

- **01 Apply for an invite.** `One email. Three quick questions on the next screen. We approve in batches.`
- **02 Lock the trip with your crew.** `Pick a city, lock the dates, pull the people in. The AI drafts the plan; the crew votes on what stays.`
- **03 Enjoy your trip.** `Bookings handled. Ledger settled.` / `Time to make memories.`
- Footer link: `↓ See a sample trip`

---

## DepartureBoard (`src/components/marketing/DepartureBoard.tsx`)

**Kicker:** `Curated by us · five starter trips`

**Headline:** `The first five trips, hand-picked for the founding crews.`

**Sub:** `Apply once and the AI plans any of them, scaled to your budget, your dates, your crew. Vibes change. Schedule changes. The plan is yours, not a template.`

**Per-trip flap-tile labels:** `Destination · Dates · Per head · Vibes`

**Per-trip CTAs:** `Plan my {City} trip →` / `Or browse the full plan`

---

## Sample trips (`src/lib/marketing/sampleTrips.ts`)

| Slug | City | Country | Vibes | Curator pick |
|---|---|---|---|---|
| mallorca | Mallorca | Spain | Beach · Foodie | For the crew that wants Med heat, cliff jumps, and slow Sunday lunches. |
| rio | Rio de Janeiro | Brazil | Carnival · Music | For the crew that wants the loudest week of the year. Sequins, samba, sunrise. |
| athens | Athens | Greece | Culture · Foodie | For the crew that wants culture without the August crowds. Late-summer Aegean energy. |
| bali | Bali | Indonesia | Wellness · Surf | For the crew that needs to slow down. Surf in the morning, rice terraces in the afternoon. |
| lagos | Lagos | Nigeria | Music · Foodie | For the crew that wants Detty December. Live bands, beach boats, never sleep. |

---

## FeatureShowcase (`src/components/marketing/FeatureShowcase.tsx`)

**Kicker:** `What you actually get`

**Headline:** `More than an AI itinerary.`

**Sub:** `Six tools that hold the trip together from booking to landing. Built so the admin works less, the crew shows up, and the trip actually happens.`

**Tiles:**
1. **The plan.** AI drafts it. Your crew votes. Done by Sunday.
2. **The ledger.** Every receipt, auto-split.
3. **The bookings.** One checklist. Everyone ticks.
4. **The chat.** A group chat that ends when the trip ends.
5. **Live flight prices.** Refreshed on demand.
6. **The memory book.** Auto-built when the trip ends. (Founding only)

---

## PricingReveal (`src/components/marketing/PricingReveal.tsx`)

**Kicker:** `Pricing`

**Headline:** `Three ways in. One invite to claim.`

**Free (£0 forever):**
- Tagline: `Try it.`
- Description: `See your invited trips. Get the AI summary draft.`
- CTA: `Apply for invite →` / `no card required`

**Crew Plus (£9 / month, £79 / yr · save 27%):**
- Ribbon: `← Most crews pick`
- Tagline: `AI plans your trip.`
- Description: `One admin pays. The whole crew gets in.`
- CTA: `Apply for Crew Plus →` / `approved in batches, weekly`

**Founding Crew (£179 / year, price locked for life):**
- Counter: `{X} / 500 left`
- Tagline: `Your AI travel concierge.`
- Description: `Dream trips, zero effort. Founding members shape the product.`
- CTA: `Claim a founding spot →` / `{X} of 500 spots left. Locked at £179 for life.`

---

## FAQ (`src/components/marketing/FAQ.tsx`)

**Kicker:** `Questions`
**Headline:** `Five questions, before you apply.`

1. **Why invite-only?** We shape the product around the first 500 crews. Less noise, more useful product, faster shipping. We approve in weekly batches, usually within seven days.
2. **What does "AI plans the trip" actually mean?** Tell us where you're flying from, who's coming, and what kind of trip you want. The AI drafts a city, dates, per-head budget, day-by-day schedule, and a bookings checklist grounded in live places data and the weather forecast for your dates. Your crew votes on what stays.
3. **Who pays. My crew or me?** One admin pays Crew Plus or Founding Crew. Everyone else gets the full trip free. The ledger inside the trip handles the actual money side, including auto-splits and per-person balances.
4. **Can I get my money back?** 14-day refund, no questions, on first-time subscriptions. Founding spots are non-refundable after the founding cohort closes, since they're price-locked for life.
5. **Why Founding Crew over Crew Plus?** Founding members get conversational AI, the during-trip assistant, the auto-built memory book, and a vote on what ships next. Crew Plus is the working tool. Founding Crew is the concierge plus a seat at the table.

Email: `Still have questions? hello@tripcrew.app`

---

## Footer (`src/components/marketing/Footer.tsx`)

**Brand col:**
- `Tripcrew`
- `Trips that make it out of the group chat.`
- `Built in London.`

**Product col:** How it works, Sample trips, Features, Pricing, FAQ
**Company col:** Apply for invite, Sign in, Contact (mailto:hello@tripcrew.app)
**Legal col:** Privacy, Terms, Cookies

**Bottom bar:** `© {year} Tripcrew. Invite only.` / `· All systems good`
