import Link from "next/link";

type ConversionCTAsProps = {
  draftId: string;
  slug: string;
};

/**
 * Two-CTA block that closes the personalised view: primary apply path,
 * secondary founding-checkout path (the route lands in Phase 2 — until
 * then it 404s, and that's the expected behaviour).
 */
export function ConversionCTAs({ draftId, slug }: ConversionCTAsProps) {
  return (
    <section className="bg-ink text-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-24 md:py-32">
        <div className="flex flex-col items-center text-center gap-8">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral">
            <span
              aria-hidden="true"
              className="inline-block w-[8px] h-[8px] bg-marketing-coral mr-3 align-middle"
            />
            Two ways in
          </p>

          <h2 className="font-serif text-[40px] md:text-[60px] leading-[1.02] tracking-[-0.025em] max-w-[22ch]">
            Unlock the full plan, or claim a founding spot.
          </h2>

          <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-5">
            <Link
              href={`/apply?draft=${draftId}`}
              className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-marketing-coral hover:bg-cream hover:border-cream transition-colors duration-150 whitespace-nowrap"
            >
              Apply to unlock the full plan →
            </Link>
            <Link
              href={`/curated/${slug}/founding-checkout?draft=${draftId}`}
              className="inline-flex items-center justify-center bg-transparent text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[56px] px-8 border-2 border-cream hover:bg-cream hover:text-ink transition-colors duration-150 whitespace-nowrap"
            >
              Claim a founding spot →
            </Link>
          </div>

          <p className="mt-4 font-mono uppercase tracking-[0.18em] text-[10px] text-cream/60 max-w-[52ch]">
            Crew Plus · £9 / mo · one admin pays, the whole crew gets in.
          </p>
        </div>
      </div>
    </section>
  );
}
