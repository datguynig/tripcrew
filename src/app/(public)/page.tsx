import Link from "next/link";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { SampleTripTile } from "@/components/marketing/SampleTripTile";
import { PricingReveal } from "@/components/marketing/PricingReveal";
import { getApplicationCount } from "@/lib/actions/applications";
import { getFoundingCrewRemaining } from "@/lib/pricing/foundingCount";
import { pickFeaturedSampleTrip } from "@/lib/marketing/sampleTrips";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [applicantCount, foundingRemaining] = await Promise.all([
    getApplicationCount(),
    getFoundingCrewRemaining(),
  ]);
  const featuredTrip = pickFeaturedSampleTrip();

  return (
    <main>
      <Hero applicantCount={applicantCount} featuredTrip={featuredTrip} />
      <HowItWorks />
      <SampleTripTile trip={featuredTrip} />
      <PricingReveal foundingRemaining={foundingRemaining} />
      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-cream px-7 py-12 border-t-2 border-cream/20">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-cream/60">
          Tripcrew · Invite only
        </p>
        <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-cream/60">
          Have an invite?{" "}
          <Link
            href="/sign-in"
            className="underline-offset-4 hover:underline"
          >
            Enter →
          </Link>
        </p>
      </div>
    </footer>
  );
}
