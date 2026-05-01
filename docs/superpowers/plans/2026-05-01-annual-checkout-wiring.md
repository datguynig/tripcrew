# Annual Crew Plus Checkout Wiring

**Goal:** Make the public copy "£9 / month or £79 / year" true at the gate boundary. Approved Crew Plus applicants currently only get a monthly checkout link — annual is advertised but unwired.

**Architecture:** The landing-page CTA goes to `/apply`, not Stripe directly, so a "monthly/annual" toggle on PricingReveal would be theatrical. The real wiring point is two-step:

1. `src/app/api/applications/[id]/checkout/route.ts` accepts `?interval=annual|monthly` and resolves either `STRIPE_PRICE_ID` (default) or `STRIPE_PRICE_ID_ANNUAL`.
2. The post-approval email surfaces both CTAs side-by-side, letting the applicant pick when they click. Annual rendered first ("save 27%"), monthly second.

The email-builder reads `STRIPE_PRICE_ID_ANNUAL` presence at build time and omits the annual CTA if unset, so the email gracefully degrades on environments without the env var configured.

**Out of scope:**
- `/account` UpgradeButton (signed-in Free → Crew Plus path). Rare given invite-only model; keep monthly-only for now.
- Stripe price provisioning — caller is responsible for setting `STRIPE_PRICE_ID_ANNUAL` in Vercel + `.env.local`. Existing Stripe price `price_1TQy2xFBs06X81bmRREQgNpz` (£79/yr GBP, same product as the live monthly) is the candidate.
- The PricingReveal landing copy stays as-is — it's already accurate once annual is wired.
- The Crew Plus monthly amount mismatch (£4.99 actual vs £9 advertised) is a separate audit item.

**Files:**

| File | Action |
|---|---|
| `src/app/api/applications/[id]/checkout/route.ts` | Accept `?interval`, resolve appropriate price ID |
| `src/lib/email/teaserEmails.ts` | `buildApplicationApprovedEmail` takes `annualEnabled` flag, renders both CTAs |
| `src/lib/actions/approveApplication.ts` | Pass `annualEnabled` based on env presence |
| `src/lib/email/__tests__/teaserEmails.test.ts` | Test both CTAs + degrade-when-unset |
| `docs/pricing.md` | Remove Open Debt item; document new env var |
| `roadmap.md` | Flip the £79/yr row from 📋 to ✅ |

**Acceptance:**
- Approved Crew Plus applicants in env with `STRIPE_PRICE_ID_ANNUAL` set receive an email with two CTAs (annual + monthly).
- Clicking the annual CTA opens Stripe Checkout for the £79/yr price.
- Clicking the monthly CTA opens Stripe Checkout for the £9/mo price (existing behavior).
- Environments without `STRIPE_PRICE_ID_ANNUAL` set still send a monthly-only email (graceful degradation).
- `pnpm build` clean.
