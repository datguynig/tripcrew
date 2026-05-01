# Yenkoh Business Docs

This folder is the repo-side index for Yenkoh's business operating knowledge. It should stay close to the code when a business promise depends on implementation, schema, environment variables, or operational procedure.

Use Notion for founder-facing planning and day-to-day review. Use this folder for code-coupled facts that should move in the same PR as product or pricing changes.

## Source Of Truth Map

| Area | Canonical source |
| --- | --- |
| Pricing, tiers, who pays | [docs/pricing.md](../pricing.md) |
| Public promises and delivery status | [public-promise-ledger.md](./public-promise-ledger.md) plus `roadmap.md` |
| Launch readiness and cutover | [launch-command-center.md](./launch-command-center.md) |
| Operating model | [operating-manual.md](./operating-manual.md) |
| Metrics and funnel definitions | [metrics-and-funnel.md](./metrics-and-funnel.md) |
| AI cost and quality controls | [ai-cost-and-quality.md](./ai-cost-and-quality.md) |
| Trust, security, and notification posture | [trust-and-notifications.md](./trust-and-notifications.md) |

## Update Rules

Update these docs in the same change when you:

- Change tier names, prices, Stripe price IDs, or gating behavior.
- Add or remove a public marketing promise.
- Change the application funnel, approval workflow, or curated teaser flow.
- Change AI model/provider behavior, Places usage, usage telemetry, or cost assumptions.
- Change trust-sensitive surfaces such as crew chat, storage, RLS, notifications, or admin access.

## Known Drift To Resolve Before Public Launch

- Annual Member is advertised as GBP 79/year, but the annual checkout path is not wired yet. Do not add an annual purchase CTA until it is.
- `roadmap.md` is intentionally stricter than shipped code: it tracks promises that may not be implemented yet. Treat it as the accountability ledger, not the current feature list.
- The Pioneer public promise includes multiple launch and month-1 features that must be reconciled before charging the tier.
