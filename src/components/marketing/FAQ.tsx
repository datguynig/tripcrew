type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Why invite-only?",
    answer:
      "We shape the product around the first 500 crews. Less noise, more useful product, faster shipping. We approve in weekly batches, usually within seven days.",
  },
  {
    question: "What does \"AI plans the trip\" actually mean?",
    answer:
      "Tell us where you're flying from, who's coming, and what kind of trip you want. The AI drafts a city, dates, per-head budget, day-by-day schedule, and a bookings checklist grounded in live places data and the weather forecast for your dates. Your crew votes on what stays.",
  },
  {
    question: "Who pays. My crew or me?",
    answer:
      "One admin pays Crew Plus or Founding Crew. Everyone else gets the full trip free. The ledger inside the trip handles the actual money side, including auto-splits and per-person balances.",
  },
  {
    question: "Can I get my money back?",
    answer:
      "14-day refund, no questions, on first-time subscriptions. Founding spots are non-refundable after the founding cohort closes, since they're price-locked for life.",
  },
  {
    question: "Why Founding Crew over Crew Plus?",
    answer:
      "Founding members get conversational AI, the during-trip assistant, the auto-built memory book, and a vote on what ships next. Crew Plus is the working tool. Founding Crew is the concierge plus a seat at the table.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="bg-cream text-ink border-t-2 border-ink">
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-24 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep mb-5">
              Questions
            </p>
            <h2 className="font-serif text-[44px] md:text-[64px] leading-[0.98] tracking-[-0.025em]">
              Five questions, <span className="font-serif italic">before you apply.</span>
            </h2>
            <p className="mt-10 font-mono uppercase tracking-[0.18em] text-[11px] text-ink/65 max-w-[28ch]">
              More to ask.{" "}
              <a
                href="mailto:hello@tripcrew.app"
                className="text-marketing-coral-deep underline underline-offset-4 hover:no-underline"
              >
                → hello@tripcrew.app
              </a>
            </p>
          </div>

          <ul className="border-t border-ink/15">
            {FAQ_ITEMS.map((item) => (
              <li key={item.question} className="border-b border-ink/15">
                <details className="group">
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-6 py-7 sm:py-8">
                    <h3 className="font-serif text-[22px] sm:text-[26px] leading-[1.2] tracking-[-0.015em] flex-1">
                      {item.question}
                    </h3>
                    <span
                      aria-hidden="true"
                      className="shrink-0 mt-2 inline-flex items-center justify-center w-7 h-7 transition-transform duration-200 group-open:rotate-180 text-marketing-coral-deep"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      >
                        <polyline points="4,7 10,13 16,7" />
                      </svg>
                    </span>
                  </summary>
                  <p className="pb-8 pr-12 text-[15px] sm:text-[17px] leading-[1.6] text-ink/80 max-w-[64ch]">
                    {item.answer}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
