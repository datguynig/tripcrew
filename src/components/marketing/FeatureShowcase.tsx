import { RevealOnView } from "@/components/motion";

type FeatureTile = {
  index: string;
  label: string;
  title: string;
  body: string;
  proof: string;
  badge?: "founding";
};

const FEATURES: FeatureTile[] = [
  {
    index: "01",
    label: "The plan",
    title: "Plan the trip, not just the itinerary.",
    body: "AI drafts a grounded plan from your origin, crew size, budget and vibes. Spec grid, day-by-day schedule, hotel picks, bookings checklist. Built in 15 seconds, scoped to your crew.",
    proof: "Powered by Gemini 3 · Google Places",
  },
  {
    index: "02",
    label: "The vote",
    title: "Plans don't stall on a silent crew.",
    body: "Every destination has photos, notes, and a yes / maybe / no vote. Late joiners catch up at a glance. Silence doesn't get to veto.",
    proof: "Yes / maybe / no · one tap",
  },
  {
    index: "03",
    label: "The bookings",
    title: "You're not the only one booking.",
    body: "Flights, accommodation, restaurants, activities. One shared list the whole crew can see, edit, and tick off.",
    proof: "Shared · live · admin-light",
  },
  {
    index: "04",
    label: "The ledger",
    title: "Money sorted. No one has to chase.",
    body: "Log a spend in two taps. Per-person balances update live. No spreadsheets, no exports, no awkward reimbursement chats after the trip.",
    proof: "Auto-split · GBP / EUR / USD",
  },
  {
    index: "05",
    label: "The chat",
    title: "The only groupchat you need for your trip.",
    body: "Photos, replies, reactions. Just for this trip. No more muting groups you can't leave.",
    proof: "Mutable · archived after the trip",
  },
  {
    index: "06",
    label: "The memory book",
    title: "A keepsake, the morning after.",
    body: "Photos, schedule, highlights, stitched into something you'll still open in five years.",
    proof: "Founding Crew · ships in M3",
    badge: "founding",
  },
];

export function FeatureShowcase() {
  return (
    <section
      id="features"
      className="bg-cream text-ink border-t-2 border-ink"
    >
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-24 md:py-32">
        <RevealOnView className="flex flex-col gap-6 mb-16 md:mb-20 max-w-[720px]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            What you actually get
          </p>
          <h2 className="font-serif text-[40px] md:text-[56px] leading-[1.02] tracking-[-0.025em]">
            The trip, sorted.
          </h2>
          <p className="text-[17px] leading-[1.55] text-ink/70 max-w-[58ch]">
            Six tools, from booking to landing. Built for the friend who&rsquo;s
            always the planner.
          </p>
        </RevealOnView>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-ink border-2 border-ink">
          {FEATURES.map((feature, index) => (
            <RevealOnView
              as="li"
              key={feature.index}
              delay={index * 0.07}
              className="group bg-cream p-7 md:p-9 flex flex-col gap-5 min-h-[320px]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
                  {feature.index}
                </span>
                {feature.badge === "founding" ? (
                  <RevealOnView
                    as="span"
                    delay={index * 0.07 + 0.2}
                    className="font-mono uppercase tracking-[0.18em] text-[9px] text-marketing-coral-deep border border-marketing-coral-deep px-2 py-1"
                  >
                    Founding only
                  </RevealOnView>
                ) : null}
              </div>

              <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
                {feature.label}
              </p>

              <h3 className="font-serif text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.015em]">
                {feature.title}
              </h3>

              <p className="text-[14px] leading-[1.6] text-ink/75 flex-1">
                {feature.body}
              </p>

              <p className="relative font-mono uppercase tracking-[0.18em] text-[9px] text-ink/65 pt-3 border-t border-ink/15">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[-1px] h-px w-full origin-left scale-x-0 bg-marketing-coral transition-transform duration-200 ease-out group-hover:scale-x-100"
                />
                {feature.proof}
              </p>
            </RevealOnView>
          ))}
        </ul>
      </div>
    </section>
  );
}
