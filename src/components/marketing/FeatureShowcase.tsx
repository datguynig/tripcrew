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
    title: "AI drafts it. Your crew votes. Done by Sunday.",
    body: "A grounded itinerary based on real places, your vibes, and the weather forecast for your dates. Spec grid, day-by-day schedule, hotel picks, bookings checklist. Generated in 15 seconds.",
    proof: "Powered by Gemini 3 + Google Places",
  },
  {
    index: "02",
    label: "The ledger",
    title: "Every receipt, auto-split.",
    body: "Log a spend in two taps. Per-person balances update live. No spreadsheets, no Splitwise exports, no settling-up after the trip.",
    proof: "Realtime ledger, multi-currency on roadmap",
  },
  {
    index: "03",
    label: "The bookings",
    title: "One checklist. Everyone ticks.",
    body: "Flights, accommodation, restaurants, activities. All in one shared list the whole crew can see, edit, and tick off as the trip locks in.",
    proof: "Shared, realtime, admin-light",
  },
  {
    index: "04",
    label: "The chat",
    title: "A group chat that ends when the trip ends.",
    body: "Photos, replies, reactions, mute toggle. Just for this trip. No more muting groups you can't leave.",
    proof: "Realtime, mutable, archived after",
  },
  {
    index: "05",
    label: "Live flight prices",
    title: "Refreshed on demand.",
    body: "Real Google Flights pricing pulled into the budget block whenever you need it. Stop tabbing between apps to compare.",
    proof: "SerpApi Google Flights, GBP/EUR/USD",
  },
  {
    index: "06",
    label: "The memory book",
    title: "Auto-built when the trip ends.",
    body: "Photos, schedule, the highlights. Stitched into a real keepsake the day after you fly home. Founding Crew benefit.",
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
        <div className="flex flex-col gap-6 mb-16 md:mb-20 max-w-[720px]">
          <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-marketing-coral-deep">
            What you actually get
          </p>
          <h2 className="font-serif text-[40px] md:text-[56px] leading-[1.02] tracking-[-0.025em]">
            More than an AI itinerary.
          </h2>
          <p className="text-[17px] leading-[1.55] text-ink/70 max-w-[58ch]">
            Six tools that hold the trip together from booking to landing. Built
            so the admin works less, the crew shows up, and the trip actually
            happens.
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-ink border-2 border-ink">
          {FEATURES.map((feature) => (
            <li
              key={feature.index}
              className="bg-cream p-7 md:p-9 flex flex-col gap-5 min-h-[320px]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono uppercase tracking-[0.22em] text-[10px] text-ink/65">
                  {feature.index}
                </span>
                {feature.badge === "founding" ? (
                  <span className="font-mono uppercase tracking-[0.18em] text-[9px] text-marketing-coral-deep border border-marketing-coral-deep px-2 py-1">
                    Founding only
                  </span>
                ) : null}
              </div>

              <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-marketing-coral-deep">
                {feature.label}
              </p>

              <h3 className="font-serif text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.015em]">
                {feature.title}
              </h3>

              <p className="text-[14px] leading-[1.6] text-ink/75 flex-1">
                {feature.body}
              </p>

              <p className="font-mono uppercase tracking-[0.18em] text-[9px] text-ink/65 pt-3 border-t border-ink/15">
                {feature.proof}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
