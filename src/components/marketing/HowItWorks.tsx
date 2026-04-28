import { RevealOnView, ScaleYOnView } from "@/components/motion";

type Step = {
  number: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    number: "01.0",
    title: "Apply for an invite.",
    body: "Five quick questions. 90 seconds. Approved in weekly batches.",
  },
  {
    number: "02.0",
    title: "Lock the trip with your crew.",
    body: "Pick a city, lock the dates, pull the people in. The AI drafts a plan grounded in your origin, your budget and your vibes. Your crew votes on what stays. The whole thing builds in 15 seconds.",
  },
  {
    number: "03.0",
    title: "Land. Eat. Repeat.",
    body: "Bookings handled. Ledger settled. Crew chat archived. Photos in the memory book.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-cream text-ink border-y-2 border-ink">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-24 md:py-32">
        <RevealOnView className="flex flex-col gap-5 mb-16 md:mb-20 max-w-[760px]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            How it works
          </p>
          <h2 className="font-serif text-[44px] md:text-[64px] leading-[0.98] tracking-[-0.025em]">
            What it takes to{" "}
            <span className="font-serif italic">finally</span> leave the chat.
          </h2>
        </RevealOnView>
        <ol className="border-t-2 border-ink">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <RevealOnView
                as="li"
                key={step.number}
                delay={index * 0.09}
                className={[
                  "relative grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-6 md:gap-12 py-10 md:py-14 md:pl-6",
                  isLast ? "border-b-2 border-ink" : "border-b border-ink/15",
                ].join(" ")}
              >
                <ScaleYOnView
                  className="hidden md:block absolute left-0 top-10 bottom-10 w-[3px] origin-top bg-marketing-coral"
                  delay={index * 0.09}
                />
                <p className="font-mono uppercase tracking-[0.18em] text-[12px] text-marketing-coral-deep md:pt-3">
                  {step.number}
                </p>
                <div className="flex flex-col gap-4 max-w-[60ch]">
                  <h3 className="font-serif text-[36px] md:text-[48px] leading-[1.05] tracking-[-0.02em] text-ink">
                    {step.title}
                  </h3>
                  <p className="text-[16px] md:text-[18px] leading-[1.55] text-ink/80">
                    {step.body}
                  </p>
                </div>
                <p className="hidden md:block font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 md:pt-3 md:text-right">
                  Step {String(index + 1).padStart(2, "0")} of 03
                </p>
              </RevealOnView>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
