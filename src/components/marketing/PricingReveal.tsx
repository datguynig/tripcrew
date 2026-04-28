import Link from "next/link";

type Tier = "free" | "plus" | "founding";

type PricingCardProps = {
  tier: Tier;
  name: string;
  price: string;
  period: string;
  tagline: string;
  description: [string, string];
  bullets: string[];
  cta: { label: string; href: string; subline: string };
  ribbon?: string;
  counter?: string;
};

function PricingCard({
  tier,
  name,
  price,
  period,
  tagline,
  description,
  bullets,
  cta,
  ribbon,
  counter,
}: PricingCardProps) {
  const isFree = tier === "free";
  const isPlus = tier === "plus";

  const bgClass = isFree
    ? "bg-cream text-ink"
    : isPlus
      ? "bg-bg-3 text-cream"
      : "bg-ink text-cream border-l-4 border-marketing-coral";

  const mutedDescription = isFree ? "text-ink/70" : "text-cream/70";
  const periodColor = isFree ? "text-ink/60" : "text-cream/60";
  const arrowColor = isFree ? "text-ink/70" : "text-cream/70";
  const bulletColor = isFree ? "text-ink/85" : "text-cream/85";
  const subColor = isFree ? "text-ink/70" : "text-cream/70";

  const ctaClass = isFree
    ? "bg-ink text-cream border-2 border-ink hover:bg-transparent hover:text-ink"
    : isPlus
      ? "bg-marketing-coral text-ink border-2 border-marketing-coral hover:bg-cream hover:text-ink hover:border-cream"
      : "bg-cream text-ink border-2 border-cream hover:bg-marketing-coral hover:text-ink hover:border-marketing-coral";

  return (
    <div className={`relative ${bgClass} p-8 flex flex-col`}>
      {ribbon ? (
        <div className="absolute top-0 right-0 px-3 py-1.5 bg-marketing-coral text-ink font-mono uppercase tracking-[0.18em] text-[10px]">
          {ribbon}
        </div>
      ) : null}
      {counter ? (
        <div className="absolute top-4 right-4 text-marketing-coral font-mono uppercase tracking-[0.18em] text-[10px]">
          {counter}
        </div>
      ) : null}

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

      <ul className="flex flex-col gap-3 mb-8">
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

      <div className="mt-auto flex flex-col gap-2">
        <Link
          href={cta.href}
          className={`inline-flex items-center justify-center font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-5 whitespace-nowrap transition-colors duration-150 ${ctaClass}`}
        >
          {cta.label}
        </Link>
        <p
          className={`font-mono uppercase tracking-[0.18em] text-[10px] text-center ${subColor}`}
        >
          {cta.subline}
        </p>
      </div>
    </div>
  );
}

export function PricingReveal({
  foundingRemaining,
}: {
  foundingRemaining: number;
}) {
  return (
    <section
      id="pricing"
      className="bg-cream text-ink border-t-2 border-ink"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="font-mono uppercase tracking-[0.18em] text-[12px] mb-8">
          Pricing
        </div>
        <h2 className="font-serif text-[40px] md:text-[52px] leading-[1.05] tracking-tight max-w-[640px] mb-16">
          Three ways in. One invite to claim.
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
            cta={{
              label: "Apply for invite →",
              href: "/apply",
              subline: "no card required",
            }}
          />

          <PricingCard
            tier="plus"
            name="Crew Plus"
            price="£9 / month"
            period="£79 / yr · save 27%"
            tagline="AI plans your trip."
            description={["One admin pays.", "The whole crew gets in."]}
            ribbon={"← Most crews pick"}
            bullets={[
              "AI plans the whole trip. The trip actually happens.",
              "One admin pays. Pro covers the whole crew.",
              'Bookings in one place. No more "who has the link?"',
              "Money sorted in-trip. One less app to juggle.",
              "A chat just for this trip. Not another group to mute.",
              "Real flight prices, refreshed on demand",
            ]}
            cta={{
              label: "Apply for Crew Plus →",
              href: "/apply?intent=plus",
              subline: "approved in batches, weekly",
            }}
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
              "Plan by talking. Conversational AI, no more forms.",
              "Each new trip starts smarter. AI learns your crew.",
              "Watching for you: flights, events, opportunities.",
              "During-trip AI. Ask anywhere, anytime.",
              "A real memory book, auto-built when the trip ends.",
              "Shape the roadmap. Your votes pick what ships next.",
              "Founder badge · founders wall · grandfathered for life",
            ]}
            cta={{
              label: "Claim a founding spot →",
              href: "/apply?intent=founding",
              subline: `${foundingRemaining} of 500 spots left. Locked at £179 for life.`,
            }}
          />
        </div>
      </div>
    </section>
  );
}
