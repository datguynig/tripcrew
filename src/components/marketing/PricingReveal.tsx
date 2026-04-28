import Link from "next/link";

type Tier = {
  name: string;
  price: string;
  priceSuffix: string;
  billing: string;
  tagline: string;
  description: string;
  bullets: string[];
  cta: { label: string; href: string };
  recommended?: boolean;
  scarcityChip?: string;
};

function getTiers(foundingRemaining: number): Tier[] {
  return [
    {
      name: "Free",
      price: "£0",
      priceSuffix: "",
      billing: "Forever · no card required",
      tagline: "Try it.",
      description: "See your invited trips. Get the AI summary draft.",
      bullets: [
        "Summary AI overview",
        "View crew trips you're invited to",
        "Crew chat + photos",
      ],
      cta: { label: "Apply for an invite →", href: "/apply" },
    },
    {
      name: "Crew Plus",
      price: "£9",
      priceSuffix: "/mo",
      billing: "£79 / year · save 27%",
      tagline: "AI plans your trip.",
      description: "One admin pays. The whole crew gets in.",
      recommended: true,
      bullets: [
        "Drafts a plan from your origin, budget, dates, vibe.",
        "Use it on every trip. No per-trip cost.",
        'Bookings in one place. No more "who has the link?"',
        "Money sorted in-trip. One less app to juggle.",
        "A chat just for this trip. Not another group to mute.",
        "Real flight prices, refreshed on demand.",
      ],
      cta: { label: "Apply for Crew Plus →", href: "/apply?intent=plus" },
    },
    {
      name: "Founding Crew",
      price: "£179",
      priceSuffix: "/year",
      billing: "Price-locked for life · founding-only",
      tagline: "Your AI travel concierge.",
      description: "Dream trips, zero effort. Founding members shape the product.",
      scarcityChip:
        foundingRemaining >= 500
          ? "Founding cohort · 500 seats"
          : `${foundingRemaining} of 500 seats remain`,
      bullets: [
        "Everything in Crew Plus",
        "Plan by talking. Conversational AI, no more forms.",
        "Each new trip starts smarter. AI learns your crew.",
        "Watching for you: flights, events, opportunities.",
        "During-trip AI. Ask anywhere, anytime.",
        "A real memory book, auto-built when the trip ends.",
        "Shape the roadmap. Your votes pick what ships next.",
        "Founder badge · founders wall · grandfathered for life.",
      ],
      cta: { label: "Claim a founding spot →", href: "/apply?intent=founding" },
    },
  ];
}

export function PricingReveal({
  foundingRemaining,
}: {
  foundingRemaining: number;
}) {
  const tiers = getTiers(foundingRemaining);

  return (
    <section
      id="pricing"
      className="bg-ink text-cream border-t-2 border-cream/15"
    >
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-24 md:py-32">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral mb-6">
          Membership
        </p>
        <h2 className="font-serif text-[44px] md:text-[64px] leading-[0.98] tracking-[-0.025em] max-w-[20ch] mb-20 md:mb-24">
          Three ways in.{" "}
          <span className="font-serif italic">One invite to claim.</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-cream/15">
          {tiers.map((tier) => (
            <TierColumn key={tier.name} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TierColumn({ tier }: { tier: Tier }) {
  return (
    <div className="relative flex flex-col py-12 md:py-0 md:px-10 border-t border-cream/15 md:border-t-0 first:border-t-0">
      <div className="min-h-[28px] mb-7 flex items-start">
        {tier.recommended ? (
          <span className="inline-flex items-center bg-marketing-coral text-ink px-3 h-7 font-mono uppercase tracking-[0.18em] text-[10px]">
            Most crews pick
          </span>
        ) : null}
        {tier.scarcityChip ? (
          <span className="inline-flex items-center bg-transparent text-marketing-coral px-3 h-7 font-mono uppercase tracking-[0.18em] text-[10px] border-2 border-marketing-coral">
            {tier.scarcityChip}
          </span>
        ) : null}
      </div>

      <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream mb-10">
        {tier.name}
      </p>

      <div className="flex items-end gap-2 mb-3">
        <p className="font-serif font-medium text-[88px] md:text-[104px] leading-[0.85] tracking-[-0.04em]">
          {tier.price}
        </p>
        {tier.priceSuffix ? (
          <p className="font-mono uppercase tracking-[0.18em] text-[12px] text-cream/85 mb-3">
            {tier.priceSuffix}
          </p>
        ) : null}
      </div>
      <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/65 mb-9">
        {tier.billing}
      </p>

      <p className="font-serif italic text-[22px] md:text-[24px] leading-[1.15] text-cream mb-3">
        {tier.tagline}
      </p>
      <p className="text-[15px] leading-[1.5] text-cream/75 mb-10 max-w-[34ch]">
        {tier.description}
      </p>

      <Link
        href={tier.cta.href}
        className={[
          "inline-flex items-center justify-center font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-5 mb-12 whitespace-nowrap transition-colors duration-150",
          tier.recommended
            ? "bg-marketing-coral text-ink border-2 border-marketing-coral hover:bg-cream hover:border-cream"
            : "bg-cream text-ink border-2 border-cream hover:bg-marketing-coral hover:border-marketing-coral",
        ].join(" ")}
      >
        {tier.cta.label}
      </Link>

      <ul className="flex flex-col gap-3 border-t border-cream/15 pt-9">
        {tier.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="font-mono text-[14px] leading-[1.4] text-marketing-coral shrink-0"
            >
              →
            </span>
            <span className="text-[14px] leading-[1.5] text-cream/85">
              {bullet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
