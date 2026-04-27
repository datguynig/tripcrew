// Five sample trips that rotate on the public landing page. Each has a
// permanent /sample-trip/<slug> URL for sharing — visitors paste the URL
// into their group chat as part of the acquisition motion.
//
// pickFeaturedSampleTrip() picks one based on UTC day-of-year mod 5 so
// the page is deterministic per day (cacheable) and rotates through all
// five over a working week. Returning visitors see fresh content.

export type SampleSpecCell = {
  label: string;
  value: string;
};

export type SampleScheduleRow = {
  day: string;
  place: string;
  note: string;
};

export type SampleTrip = {
  slug: string;
  city: string;
  occasionLine: string;
  datesLabel: string;
  durationLabel: string;
  crewLabel: string;
  vibesLabel: string;
  vibesPlusLabel: string;
  totalDays: number;
  visibleDays: number;
  specCells: readonly SampleSpecCell[];
  schedule: readonly SampleScheduleRow[];
  highlights: readonly string[];
  // Currency code for the per-head value, used by the /sample-trip/[slug]
  // page when rendering the spec grid via TripPreview.
  currency: "GBP";
  perHeadAmount: number;
  origin: string;
  vibesMeta: string;
};

const TRIPS: readonly SampleTrip[] = [
  {
    slug: "mallorca",
    city: "Mallorca",
    occasionLine: "Six friends. Six days. June.",
    datesLabel: "Jun 14 — Jun 19",
    durationLabel: "6 days",
    crewLabel: "6 crew",
    vibesLabel: "Beach · Foodie",
    vibesPlusLabel: "Beach + Foodie",
    totalDays: 6,
    visibleDays: 3,
    perHeadAmount: 820,
    currency: "GBP",
    origin: "LHR",
    vibesMeta: "Beach · Foodie",
    specCells: [
      { label: "Per head", value: "£820" },
      { label: "Crew", value: "6" },
      { label: "From", value: "LHR" },
      { label: "Vibes", value: "Beach · Foodie" },
    ],
    schedule: [
      {
        day: "Day 1",
        place: "Sóller arrival",
        note: "Drop bags at the villa above Sóller. Sunset on the rocks at Port de Sóller, first round on the terrace.",
      },
      {
        day: "Day 2",
        place: "Cala Deià",
        note: "Wind down through the olive groves. Long lunch on the cliffs. Cliff jumps if anyone's still got the nerve.",
      },
      {
        day: "Day 3",
        place: "Tramuntana drive",
        note: "Jeep through Valldemossa and Banyalbufar. Stop at Mirador Es Colomer for the cliff views. Dinner back in Sóller.",
      },
    ],
    highlights: ["Sóller", "Cala Deià", "Tramuntana"],
  },
  {
    slug: "rio",
    city: "Rio de Janeiro",
    occasionLine: "Six friends. Carnival. Sequins on.",
    datesLabel: "Feb 5 — Feb 12",
    durationLabel: "7 days",
    crewLabel: "6 crew",
    vibesLabel: "Carnival · Music",
    vibesPlusLabel: "Carnival + Music",
    totalDays: 7,
    visibleDays: 3,
    perHeadAmount: 1500,
    currency: "GBP",
    origin: "LHR",
    vibesMeta: "Carnival · Music",
    specCells: [
      { label: "Per head", value: "£1,500" },
      { label: "Crew", value: "6" },
      { label: "From", value: "LHR" },
      { label: "Vibes", value: "Carnival · Music" },
    ],
    schedule: [
      {
        day: "Day 1",
        place: "Ipanema arrival",
        note: "Land at GIG. Drop bags at the Ipanema flat. Sundown caipirinhas on the beach, first night easy.",
      },
      {
        day: "Day 2",
        place: "Sambódromo opening",
        note: "Get dressed — sequins not optional. Ringside seats at the Sambódromo. Out till sunrise.",
      },
      {
        day: "Day 3",
        place: "Cristo + Sugarloaf",
        note: "Cristo Redentor at golden hour. Cable car up Sugarloaf for the night skyline. Recover with feijoada in Lapa.",
      },
    ],
    highlights: ["Ipanema", "Sambódromo", "Cristo"],
  },
  {
    slug: "athens",
    city: "Athens",
    occasionLine: "Six friends. Six days. Late summer.",
    datesLabel: "Sep 5 — Sep 11",
    durationLabel: "6 days",
    crewLabel: "6 crew",
    vibesLabel: "Culture · Foodie",
    vibesPlusLabel: "Culture + Foodie",
    totalDays: 6,
    visibleDays: 3,
    perHeadAmount: 680,
    currency: "GBP",
    origin: "LHR",
    vibesMeta: "Culture · Foodie",
    specCells: [
      { label: "Per head", value: "£680" },
      { label: "Crew", value: "6" },
      { label: "From", value: "LHR" },
      { label: "Vibes", value: "Culture · Foodie" },
    ],
    schedule: [
      {
        day: "Day 1",
        place: "Plaka arrival",
        note: "Apartment at the foot of the Acropolis. Rooftop dinner as the rock lights up. Walk it off through Plaka.",
      },
      {
        day: "Day 2",
        place: "Acropolis at dawn",
        note: "Up early to beat the crowds. Coffee in Anafiotika. Afternoon at the National Archaeological Museum.",
      },
      {
        day: "Day 3",
        place: "Aegina day trip",
        note: "Ferry from Piraeus. Pistachio ice cream on the harbour. Swim at Marathonas, octopus for dinner.",
      },
    ],
    highlights: ["Acropolis", "Aegina", "Anafiotika"],
  },
  {
    slug: "bali",
    city: "Bali",
    occasionLine: "Six friends. Nine days. Wellness mode.",
    datesLabel: "Apr 18 — Apr 26",
    durationLabel: "9 days",
    crewLabel: "6 crew",
    vibesLabel: "Wellness · Surf",
    vibesPlusLabel: "Wellness + Surf",
    totalDays: 9,
    visibleDays: 3,
    perHeadAmount: 1500,
    currency: "GBP",
    origin: "LHR",
    vibesMeta: "Wellness · Surf",
    specCells: [
      { label: "Per head", value: "£1,500" },
      { label: "Crew", value: "6" },
      { label: "From", value: "LHR" },
      { label: "Vibes", value: "Wellness · Surf" },
    ],
    schedule: [
      {
        day: "Day 1",
        place: "Canggu arrival",
        note: "Land in Denpasar. Pool villa five minutes from Echo Beach. First sunset, first Bintang.",
      },
      {
        day: "Day 2",
        place: "Surf + smoothies",
        note: "Beginners' lesson at Old Man's. Açaí bowls after. Massage everyone could afford in Bali.",
      },
      {
        day: "Day 3",
        place: "Ubud transfer",
        note: "Drive up via Tanah Lot. Rice-terrace villa above Ubud. Slow dinner in Penestanan.",
      },
    ],
    highlights: ["Canggu", "Echo Beach", "Ubud"],
  },
  {
    slug: "lagos",
    city: "Lagos",
    occasionLine: "Six friends. Eight days. Detty December.",
    datesLabel: "Dec 20 — Dec 27",
    durationLabel: "8 days",
    crewLabel: "6 crew",
    vibesLabel: "Music · Foodie",
    vibesPlusLabel: "Music + Foodie",
    totalDays: 8,
    visibleDays: 3,
    perHeadAmount: 1200,
    currency: "GBP",
    origin: "LHR",
    vibesMeta: "Music · Foodie",
    specCells: [
      { label: "Per head", value: "£1,200" },
      { label: "Crew", value: "6" },
      { label: "From", value: "LHR" },
      { label: "Vibes", value: "Music · Foodie" },
    ],
    schedule: [
      {
        day: "Day 1",
        place: "Victoria Island arrival",
        note: "Land at LOS. Apartment on Victoria Island. First night easy — beach club on the lagoon, Afrobeats till late.",
      },
      {
        day: "Day 2",
        place: "Lekki + suya",
        note: "Lekki Arts and Crafts Market in the morning. Suya at Glover Court for dinner. Live band after.",
      },
      {
        day: "Day 3",
        place: "Tarkwa Bay",
        note: "Boat across from Five Cowrie Creek. Beach all day, fresh fish on the sand. Reggae night back on the mainland.",
      },
    ],
    highlights: ["Victoria Island", "Tarkwa Bay", "Lekki"],
  },
] as const;

export const SAMPLE_TRIPS = TRIPS;

export function pickFeaturedSampleTrip(now: Date = new Date()): SampleTrip {
  const utcStart = Date.UTC(now.getUTCFullYear(), 0, 0);
  const utcNow = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dayOfYear = Math.floor((utcNow - utcStart) / 86_400_000);
  const index = ((dayOfYear % TRIPS.length) + TRIPS.length) % TRIPS.length;
  return TRIPS[index]!;
}

export function getSampleTripBySlug(slug: string): SampleTrip | null {
  return TRIPS.find((t) => t.slug === slug) ?? null;
}
