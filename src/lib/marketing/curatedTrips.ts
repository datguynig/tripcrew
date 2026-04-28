// Five sample trips that anchor the public landing page. Each has a
// permanent /curated/<slug> URL for sharing — visitors paste the
// URL into their group chat as part of the acquisition motion.
//
// pickFeaturedCuratedTrip() picks one based on UTC day-of-year mod 5 so
// the page is deterministic per day (cacheable) and rotates through
// all five over a working week. Returning visitors see fresh content.
//
// The DepartureBoard rotator on the landing page also flips through
// all five in-place, so the page never feels static even on a single
// pageview.

export type SampleSpecCell = {
  label: string;
  value: string;
};

export type SampleScheduleRow = {
  day: string;
  place: string;
  note: string;
};

export type CuratedTrip = {
  slug: string;
  city: string;
  country: string;
  iata: string;
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
  currency: "GBP";
  perHeadAmount: number;
  origin: string;
  vibesMeta: string;
  heroPhotoUrl: string;
  heroPhotoCredit: { name: string; href: string };
  latitude: number;
  longitude: number;
  // Editorial framing on the landing rotator. "Why we picked it" gives the
  // visitor a reason to slow down on each card without bloating the spec.
  curatorPick: string;
  // Drives the per-trip CTA destination on the landing rotator.
  // /apply pre-seeds the application form with the trip's vibes.
  applyVibes: string;
};

const TRIPS: readonly CuratedTrip[] = [
  {
    slug: "mallorca",
    city: "Mallorca",
    country: "Spain",
    iata: "PMI",
    curatorPick: "For the crew that wants Med heat, cliff jumps, and slow Sunday lunches.",
    applyVibes: "beach,foodie",
    occasionLine: "Six friends. Six days. June.",
    datesLabel: "14 to 19 June",
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
    latitude: 39.5696,
    longitude: 2.6502,
    heroPhotoUrl:
      "https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?auto=format&fit=crop&w=1600&q=80",
    heroPhotoCredit: {
      name: "Anna Sullivan",
      href: "https://unsplash.com/photos/SbOC7CN9j_w",
    },
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
    country: "Brazil",
    iata: "GIG",
    curatorPick: "For the crew that wants the loudest week of the year. Sequins, samba, sunrise.",
    applyVibes: "music,carnival",
    occasionLine: "Six friends. Carnival. Sequins on.",
    datesLabel: "5 to 12 February",
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
    latitude: -22.9068,
    longitude: -43.1729,
    heroPhotoUrl:
      "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1600&q=80",
    heroPhotoCredit: {
      name: "Agustin Diaz",
      href: "https://unsplash.com/photos/aerial-photo-of-rio",
    },
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
        note: "Get dressed. Sequins not optional. Ringside seats at the Sambódromo. Out till sunrise.",
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
    country: "Greece",
    iata: "ATH",
    curatorPick: "For the crew that wants culture without the August crowds. Late-summer Aegean energy.",
    applyVibes: "culture,foodie",
    occasionLine: "Six friends. Six days. Late summer.",
    datesLabel: "5 to 11 September",
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
    latitude: 37.9838,
    longitude: 23.7275,
    heroPhotoUrl:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1600&q=80",
    heroPhotoCredit: {
      name: "Spencer Davis",
      href: "https://unsplash.com/@spencerdavis",
    },
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
    country: "Indonesia",
    iata: "DPS",
    curatorPick: "For the crew that needs to slow down. Surf in the morning, rice terraces in the afternoon.",
    applyVibes: "wellness,surf",
    occasionLine: "Six friends. Nine days. Wellness mode.",
    datesLabel: "18 to 26 April",
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
    latitude: -8.4095,
    longitude: 115.1889,
    heroPhotoUrl:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1600&q=80",
    heroPhotoCredit: {
      name: "Niklas Weiss",
      href: "https://unsplash.com/@niklasweiss",
    },
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
    country: "Nigeria",
    iata: "LOS",
    curatorPick: "For the crew that wants Detty December. Live bands, beach boats, never sleep.",
    applyVibes: "music,foodie",
    occasionLine: "Six friends. Eight days. Detty December.",
    datesLabel: "20 to 27 December",
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
    latitude: 6.5244,
    longitude: 3.3792,
    heroPhotoUrl:
      "https://images.unsplash.com/photo-1618828665011-0abd973f7bb8?auto=format&fit=crop&w=1600&q=80",
    heroPhotoCredit: {
      name: "Tope Asokere",
      href: "https://unsplash.com/@topedotcom",
    },
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
        note: "Land at LOS. Apartment on Victoria Island. First night easy. Beach club on the lagoon, Afrobeats till late.",
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

export const CURATED_TRIPS = TRIPS;

export function pickFeaturedCuratedTrip(now: Date = new Date()): CuratedTrip {
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

export function getCuratedTripBySlug(slug: string): CuratedTrip | null {
  return TRIPS.find((t) => t.slug === slug) ?? null;
}
