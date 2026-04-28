import { DepartureBoard } from "@/components/marketing/DepartureBoard";
import { FAQ } from "@/components/marketing/FAQ";
import { FeatureShowcase } from "@/components/marketing/FeatureShowcase";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { PainResonance } from "@/components/marketing/PainResonance";
import { PricingReveal } from "@/components/marketing/PricingReveal";
import { getApplicationCount } from "@/lib/actions/applications";
import {
  pickFeaturedSampleTrip,
  SAMPLE_TRIPS,
} from "@/lib/marketing/sampleTrips";
import { getFoundingCrewRemaining } from "@/lib/pricing/foundingCount";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [applicantCount, foundingRemaining] = await Promise.all([
    getApplicationCount(),
    getFoundingCrewRemaining(),
  ]);
  const featuredTrip = pickFeaturedSampleTrip();
  const initialIndex = SAMPLE_TRIPS.findIndex(
    (trip) => trip.slug === featuredTrip.slug,
  );

  return (
    <main>
      <Hero
        applicantCount={applicantCount}
        featuredTrip={featuredTrip}
        foundingRemaining={foundingRemaining}
      />
      <PainResonance />
      <HowItWorks />
      <DepartureBoard initialIndex={initialIndex >= 0 ? initialIndex : 0} />
      <FeatureShowcase />
      <PricingReveal foundingRemaining={foundingRemaining} />
      <FAQ />
      <Footer />
    </main>
  );
}
