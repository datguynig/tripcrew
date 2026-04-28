import Link from "next/link";

/**
 * Rendered in place of the teaser form when the visitor has hit the
 * 2-draft lifetime cap on their IP. Pushes them straight to the
 * application funnel where their existing drafts will be folded into
 * the application review.
 */
export function RateLimitedNotice() {
  return (
    <div className="border-2 border-ink bg-cream p-7 sm:p-9 flex flex-col gap-5">
      <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
        <span
          aria-hidden="true"
          className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
        />
        Limit reached
      </p>

      <p className="font-serif text-[26px] sm:text-[32px] leading-[1.1] tracking-[-0.02em] max-w-[24ch]">
        You&rsquo;ve already started two drafts.
      </p>

      <p className="text-[15px] sm:text-[16px] leading-[1.55] text-ink/75 max-w-[48ch]">
        To start more, apply for an invite. We&rsquo;ll fold your existing drafts
        into your application.
      </p>

      <div className="pt-2">
        <Link
          href="/apply"
          className="inline-flex items-center justify-center bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-7 border-2 border-marketing-coral hover:bg-ink hover:text-cream hover:border-ink transition-colors duration-150 whitespace-nowrap"
        >
          Apply for an invite →
        </Link>
      </div>
    </div>
  );
}
