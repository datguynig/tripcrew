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
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-24 md:py-32">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep mb-6">
          Questions
        </p>
        <h2 className="font-serif text-[40px] md:text-[56px] leading-[1.02] tracking-[-0.025em] mb-14 max-w-[20ch]">
          Five questions, before you apply.
        </h2>

        <ul className="border-t-2 border-ink">
          {FAQ_ITEMS.map((item) => (
            <li key={item.question} className="border-b-2 border-ink">
              <details className="group">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-6 py-6 sm:py-8">
                  <h3 className="font-serif text-[22px] sm:text-[28px] leading-[1.15] tracking-[-0.015em]">
                    {item.question}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="shrink-0 mt-1 w-9 h-9 border-2 border-ink flex items-center justify-center font-mono text-[16px] transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-8 pr-14 text-[15px] sm:text-[17px] leading-[1.6] text-ink/75 max-w-[64ch]">
                  {item.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>

        <p className="mt-12 font-mono uppercase tracking-[0.18em] text-[11px] text-ink/70">
          Still have questions?{" "}
          <a
            href="mailto:hello@tripcrew.app"
            className="text-marketing-coral-deep underline underline-offset-4 hover:no-underline"
          >
            hello@tripcrew.app
          </a>
        </p>
      </div>
    </section>
  );
}
