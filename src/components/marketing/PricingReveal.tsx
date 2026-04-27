type Tier = "free" | "plus" | "founding";

type PricingCardProps = {
  tier: Tier;
  name: string;
  price: string;
  period: string;
  tagline: string;
  description: [string, string];
  bullets: string[];
  ribbon?: string;
  counter?: string;
};

const CORAL = "#ff5e3a";

function PricingCard({
  tier,
  name,
  price,
  period,
  tagline,
  description,
  bullets,
  ribbon,
  counter,
}: PricingCardProps) {
  const isFree = tier === "free";
  const isPlus = tier === "plus";
  const isFounding = tier === "founding";

  const bgClass = isFree
    ? "bg-cream text-ink"
    : isPlus
      ? "text-cream"
      : "bg-ink text-cream";

  const inlineBg = isPlus ? { backgroundColor: "#1a1a1a" } : undefined;
  const foundingBorderStyle = isFounding
    ? { borderLeft: `4px solid ${CORAL}` }
    : undefined;

  const mutedDescription = isFree ? "text-ink/70" : "text-cream/70";
  const periodColor = isFree ? "text-ink/60" : "text-cream/60";
  const arrowColor = isFree ? "text-ink/40" : "text-cream/40";
  const bulletColor = isFree ? "text-ink/85" : "text-cream/85";

  return (
    <div
      className={`relative ${bgClass} p-8 flex flex-col`}
      style={{ ...inlineBg, ...foundingBorderStyle }}
    >
      {ribbon && (
        <div
          className="absolute top-0 right-0 px-3 py-1.5 font-mono uppercase tracking-[0.18em] text-[10px] text-cream"
          style={{ backgroundColor: CORAL }}
        >
          {ribbon}
        </div>
      )}
      {counter && (
        <div
          className="absolute top-4 right-4 font-mono uppercase tracking-[0.18em] text-[10px]"
          style={{ color: CORAL }}
        >
          {counter}
        </div>
      )}

      <div className="font-mono uppercase tracking-[0.18em] text-[11px] mb-6">
        {name}
      </div>

      <div className="font-serif text-[32px] leading-none mb-2">{price}</div>

      <div
        className={`font-mono uppercase tracking-[0.15em] text-[10px] ${periodColor} mb-8`}
      >
        {period}
      </div>

      <div className="font-serif text-[20px] leading-snug mb-3">{tagline}</div>

      <p className={`text-[14px] leading-relaxed ${mutedDescription} mb-8`}>
        {description[0]}
        <br />
        {description[1]}
      </p>

      <ul className="flex flex-col gap-3 mt-auto">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3">
            <span
              className={`font-mono text-[13px] leading-snug shrink-0 mt-0.5 ${arrowColor}`}
              aria-hidden="true"
            >
              {"→"}
            </span>
            <span className={`text-[14px] leading-snug ${bulletColor}`}>
              {bullet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingReveal({
  foundingRemaining,
}: {
  foundingRemaining: number;
}) {
  return (
    <section className="bg-cream text-ink border-t-2 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="font-mono uppercase tracking-[0.18em] text-[12px] mb-8">
          Pricing
        </div>
        <h2 className="font-serif text-[40px] md:text-[52px] leading-[1.05] tracking-tight max-w-[640px] mb-16">
          Three tiers. One price-lock. Pick the one that gets your crew there.
        </h2>

        <div className="border-2 border-ink grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-ink">
          <PricingCard
            tier="free"
            name="Free"
            price="£0"
            period="forever"
            tagline="Try it."
            description={[
              "See your invited trips.",
              "Get the AI summary draft.",
            ]}
            bullets={[
              "Summary AI overview",
              "View crew trips you're invited to",
              "Crew chat + photos",
            ]}
          />

          <PricingCard
            tier="plus"
            name="Crew Plus"
            price="£9 / month"
            period="£79 / yr · save 27%"
            tagline="AI plans your trip."
            description={["One admin pays;", "the whole crew gets in."]}
            ribbon={"← Most crews pick"}
            bullets={[
              "AI plans the whole trip — the trip actually happens",
              "One admin pays — Pro covers the whole crew",
              'Bookings in one place — no more "who has the link?"',
              "Money sorted in-trip — one less app to juggle",
              "A chat just for this trip — not another group to mute",
              "Real flight prices, refreshed on demand",
            ]}
          />

          <PricingCard
            tier="founding"
            name="Founding Crew"
            price="£179 / year"
            period="price locked for life"
            tagline="Your AI travel concierge."
            description={[
              "Dream trips, zero effort.",
              "Founding members shape the product.",
            ]}
            counter={`${foundingRemaining} / 500 left`}
            bullets={[
              "Everything in Crew Plus",
              "Plan by talking — conversational AI, no more forms",
              "Each new trip starts smarter — AI learns your crew",
              "Watching for you — flights, events, opportunities",
              "During-trip AI — ask anywhere, anytime",
              "A real memory book — auto-built when the trip ends",
              "Shape the roadmap — your votes pick what ships next",
              "Founder badge · founders wall · grandfathered for life",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
