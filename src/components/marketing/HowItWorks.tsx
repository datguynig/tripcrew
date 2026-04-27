type Step = {
  number: string;
  title: string;
  body: string[];
  numberClassName: string;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Apply for an invite.",
    body: [
      "One email. Three quick questions on the next screen. We approve in batches.",
    ],
    numberClassName: "text-ink/40",
  },
  {
    number: "02",
    title: "Lock the trip with your crew.",
    body: [
      "Pick a city, lock the dates, pull the people in. The AI drafts the plan; the crew votes on what stays.",
    ],
    numberClassName: "text-ink/40",
  },
  {
    number: "03",
    title: "Enjoy your trip.",
    body: ["Bookings handled. Ledger settled.", "Time to make memories."],
    numberClassName: "text-marketing-coral",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-cream text-ink border-y-2 border-ink">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 border-2 border-ink md:grid-cols-3">
          {STEPS.map((step, index) => {
            const isLastColumn = index === STEPS.length - 1;
            const isLastRow = index === STEPS.length - 1;
            return (
              <div
                key={step.number}
                className={[
                  "flex flex-col p-8",
                  isLastRow ? "" : "border-b-2 border-ink md:border-b-0",
                  isLastColumn ? "" : "md:border-r-2 md:border-ink",
                ].join(" ")}
              >
                <div
                  className={[
                    "font-mono uppercase tracking-[0.18em] text-[56px] leading-none",
                    step.numberClassName,
                  ].join(" ")}
                >
                  {step.number}
                </div>

                <h3 className="mt-8 font-serif text-[28px] leading-[1.15] tracking-[-0.01em] text-ink">
                  {step.title}
                </h3>

                <div className="mt-5 flex flex-col gap-4 text-[15px] leading-[1.55] text-ink/80">
                  {step.body.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <a
            href="#sample-trip"
            className="font-mono uppercase tracking-[0.22em] text-[11px] text-ink/50 transition-opacity duration-150 hover:text-ink/80"
          >
            ↓ See a sample trip
          </a>
        </div>
      </div>
    </section>
  );
}
