import Link from "next/link";

type Props = {
  slug: string;
  draftId: string | null;
};

/**
 * Sits below the application-received message on /curated/[slug]/applied.
 * When the applicant has a linked draft, the CTA points at the trip's
 * founding-checkout. Cold-form applicants (no draft) get a softer link
 * back to the pricing block on the marketing home so they still have a
 * way to skip the queue without us synthesising a draft id.
 */
export function SkipTheQueueUpsell({ slug, draftId }: Props) {
  const ctaHref = draftId
    ? `/curated/${slug}/founding-checkout?draft=${draftId}`
    : "/#pricing";
  const ctaLabel = draftId
    ? "Claim a founding spot →"
    : "See founding pricing →";

  return (
    <aside
      aria-labelledby="skip-the-queue-heading"
      className="mt-16 border-2 border-ink bg-cream"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:gap-12 px-8 py-10 md:px-12 md:py-12 lg:items-center">
        <div className="flex flex-col gap-4 max-w-[42ch]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            <span
              aria-hidden="true"
              className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
            />
            Still open
          </p>
          <h2
            id="skip-the-queue-heading"
            className="font-serif text-[34px] md:text-[42px] leading-[1.02] tracking-[-0.025em] text-ink"
          >
            Don&rsquo;t want to wait?
          </h2>
          <p className="text-[16px] md:text-[17px] leading-[1.55] text-ink/80">
            Skip the queue with a founding spot. The same Member access,
            unlocked the moment you check out.
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-4">
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-marketing-coral hover:bg-ink hover:text-cream hover:border-ink transition-colors duration-150 whitespace-nowrap"
          >
            {ctaLabel}
          </Link>
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 lg:text-right">
            £179 / year · price-locked for life · 500 limited.
          </p>
        </div>
      </div>
    </aside>
  );
}
