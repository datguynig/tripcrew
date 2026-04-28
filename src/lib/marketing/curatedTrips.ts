export type SampleSpecCell = {
  label: string;
  value: string;
};

export type SampleScheduleRow = {
  day: string;
  place: string;
  note: string;
};

export type CuratedStay = {
  name: string;
  neighbourhood: string;
  pricePerNight: string;
  rating: string;
  photoUrl: string;
};

export type CuratedBooking = {
  category: "flights" | "stay" | "dinner" | "activity" | "transport";
  label: string;
  detail: string;
};

export type CuratedFlight = {
  carrier: string;
  route: string;
  duration: string;
  pricePerHead: string;
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
  fullSchedule: readonly SampleScheduleRow[];
  bookings: readonly CuratedBooking[];
  stays: readonly CuratedStay[];
  flights: readonly CuratedFlight[];
  highlights: readonly string[];
  currency: "GBP";
  perHeadAmount: number;
  origin: string;
  vibesMeta: string;
  heroPhotoUrl: string;
  heroPhotoCredit: { name: string; href: string };
  latitude: number;
  longitude: number;
  curatorPick: string;
  applyVibes: string;
  tagline: string;
};

const TRIPS: readonly CuratedTrip[] = [
  {
    slug: "mallorca",
    city: "Mallorca",
    country: "Spain",
    iata: "PMI",
    tagline: "Med heat, cliff jumps, slow Sunday lunches.",
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
    fullSchedule: [
      {
        day: "Day 1 · Sat",
        place: "Sóller arrival",
        note: "Drop bags at the villa above Sóller. Sunset on the rocks at Port de Sóller, first round on the terrace at Randemar.",
      },
      {
        day: "Day 2 · Sun",
        place: "Cala Deià",
        note: "Drive down through the olive groves. Long lunch at Ca's Patró March. Cliff jumps if anyone's still got the nerve.",
      },
      {
        day: "Day 3 · Mon",
        place: "Tramuntana drive",
        note: "Jeep through Valldemossa and Banyalbufar. Stop at Mirador Es Colomer for the cliff views. Dinner back in Sóller at Ca'n Boqueta.",
      },
      {
        day: "Day 4 · Tue",
        place: "Boat charter",
        note: "Skipper for the day from Port de Sóller. Sa Calobra and Cala Tuent. Pack lunch from Ca'n Pere. Back in for tapas at Sa Cova.",
      },
      {
        day: "Day 5 · Wed",
        place: "Palma + Santa Catalina",
        note: "Train from Sóller to Palma. Cathedral, vintage shops in Santa Catalina, dinner at Ola del Mar with the wine list deep.",
      },
      {
        day: "Day 6 · Thu",
        place: "Slow morning, fly home",
        note: "Pastries at Forn de Sant Joan. Last swim at Cala Tuent. Drop the rental in Palma, evening flight back to LHR.",
      },
    ],
    bookings: [
      { category: "flights", label: "Return flights · LHR ↔ PMI", detail: "British Airways · 2h 25m · £210pp" },
      { category: "stay", label: "Villa for 6 above Sóller", detail: "5 nights · pool · £85pp/night" },
      { category: "transport", label: "Two 4×4 hires", detail: "Sixt · airport pickup · £40pp total" },
      { category: "dinner", label: "Ca's Patró March, Cala Deià", detail: "Sunday lunch · 14:00 · book 4 weeks out" },
      { category: "activity", label: "Boat charter, Port de Sóller", detail: "Day skipper · 09:00 to 18:00 · £95pp" },
      { category: "dinner", label: "Ola del Mar, Santa Catalina", detail: "Wednesday · 21:00 · book 2 weeks out" },
    ],
    stays: [
      {
        name: "Finca Can Bisbal",
        neighbourhood: "Sóller, hills above town",
        pricePerNight: "£85pp",
        rating: "4.9",
        photoUrl: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    flights: [
      { carrier: "British Airways", route: "LHR → PMI", duration: "2h 25m", pricePerHead: "£210" },
      { carrier: "easyJet", route: "LGW → PMI", duration: "2h 30m", pricePerHead: "£165" },
    ],
    highlights: ["Sóller", "Cala Deià", "Tramuntana"],
  },
  {
    slug: "rio",
    city: "Rio de Janeiro",
    country: "Brazil",
    iata: "GIG",
    tagline: "Sequins, samba, sunrise.",
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
    fullSchedule: [
      {
        day: "Day 1 · Fri",
        place: "Ipanema arrival",
        note: "Land at GIG. Drop bags at the Ipanema flat. Sundown caipirinhas at Garota de Ipanema, first night easy on the beach.",
      },
      {
        day: "Day 2 · Sat",
        place: "Sambódromo opening",
        note: "Beach morning at Posto 9. Get dressed in the afternoon, sequins not optional. Ringside seats at the Sambódromo. Out till sunrise.",
      },
      {
        day: "Day 3 · Sun",
        place: "Cristo + Sugarloaf",
        note: "Cristo Redentor at golden hour. Cable car up Sugarloaf for the night skyline. Recover with feijoada at Casa da Feijoada in Lapa.",
      },
      {
        day: "Day 4 · Mon",
        place: "Santa Teresa + Lapa",
        note: "Tram up to Santa Teresa. Lunch at Aprazível with the city laid out below. Selarón steps. Lapa arches and live samba at Pedra do Sal.",
      },
      {
        day: "Day 5 · Tue",
        place: "Carnival block parties",
        note: "Daytime blocos through the streets of Botafogo and Glória. Beer at every block. Bloco da Favorita in the afternoon.",
      },
      {
        day: "Day 6 · Wed",
        place: "Beach + Pedra Bonita",
        note: "Slow morning at Leblon. Hike Pedra Bonita for the panorama. Final dinner at Fasano with the ocean in the window.",
      },
      {
        day: "Day 7 · Thu",
        place: "Last beach, fly home",
        note: "Açaí and last swim at Ipanema. Cab to GIG. Overnight back to LHR.",
      },
    ],
    bookings: [
      { category: "flights", label: "Return flights · LHR ↔ GIG", detail: "British Airways direct · 11h 35m · £680pp" },
      { category: "stay", label: "Ipanema apartment for 6", detail: "6 nights · 2 mins from Posto 9 · £105pp/night" },
      { category: "activity", label: "Sambódromo · Sector 9", detail: "Saturday · ringside · £180pp · book by Dec" },
      { category: "dinner", label: "Casa da Feijoada, Ipanema", detail: "Sunday lunch · 13:00 · walk-in" },
      { category: "activity", label: "Cristo Redentor · Trem do Corcovado", detail: "Sunset slot · £35pp · pre-book" },
      { category: "dinner", label: "Fasano Al Mare, Ipanema", detail: "Wednesday · 21:30 · book 6 weeks out" },
    ],
    stays: [
      {
        name: "Janeiro Hotel",
        neighbourhood: "Leblon, beachfront",
        pricePerNight: "£140pp",
        rating: "4.8",
        photoUrl: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    flights: [
      { carrier: "British Airways", route: "LHR → GIG", duration: "11h 35m", pricePerHead: "£680" },
      { carrier: "TAP Air Portugal", route: "LHR → LIS → GIG", duration: "13h 45m", pricePerHead: "£540" },
    ],
    highlights: ["Ipanema", "Sambódromo", "Cristo"],
  },
  {
    slug: "athens",
    city: "Athens",
    country: "Greece",
    iata: "ATH",
    tagline: "Late-summer Aegean, no August crowds.",
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
    fullSchedule: [
      {
        day: "Day 1 · Sat",
        place: "Plaka arrival",
        note: "Apartment at the foot of the Acropolis. Rooftop dinner at A for Athens as the rock lights up. Walk it off through Plaka.",
      },
      {
        day: "Day 2 · Sun",
        place: "Acropolis at dawn",
        note: "Up at 07:00 to beat the crowds. Coffee in Anafiotika. Afternoon at the National Archaeological Museum. Dinner at Mani Mani.",
      },
      {
        day: "Day 3 · Mon",
        place: "Aegina day trip",
        note: "Ferry from Piraeus at 09:00. Pistachio ice cream on the harbour. Swim at Marathonas, octopus and ouzo at Skotadis.",
      },
      {
        day: "Day 4 · Tue",
        place: "Cape Sounion sunset",
        note: "Drive south down the Apollo coast. Lunch at Ithaki Beach. Temple of Poseidon at sunset, golden hour over the Aegean.",
      },
      {
        day: "Day 5 · Wed",
        place: "Psyrri + Exarcheia",
        note: "Slow morning. Souvlaki at Kostas. Afternoon in Exarcheia, vinyl shops and street art. Late dinner at Diporto, no menu, just what's good.",
      },
      {
        day: "Day 6 · Thu",
        place: "Last swim, fly home",
        note: "Coffee at Taf. Last swim at Astir Beach. Late lunch in Glyfada. Evening flight back to LHR.",
      },
    ],
    bookings: [
      { category: "flights", label: "Return flights · LHR ↔ ATH", detail: "Aegean Airlines direct · 3h 50m · £180pp" },
      { category: "stay", label: "Apartment in Plaka", detail: "5 nights · 6 sleeps · £55pp/night" },
      { category: "activity", label: "Acropolis tickets", detail: "Skip-the-line · 07:30 entry · £18pp" },
      { category: "transport", label: "Aegina ferry · return", detail: "Piraeus → Aegina · 1h · £20pp" },
      { category: "dinner", label: "Skotadis, Aegina", detail: "Monday · 20:00 · walk-in" },
      { category: "transport", label: "Two car hires for Sounion", detail: "Hertz · day rental · £25pp total" },
    ],
    stays: [
      {
        name: "Coco-Mat Athens BC",
        neighbourhood: "Plaka, Acropolis-facing",
        pricePerNight: "£75pp",
        rating: "4.7",
        photoUrl: "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    flights: [
      { carrier: "Aegean Airlines", route: "LHR → ATH", duration: "3h 50m", pricePerHead: "£180" },
      { carrier: "British Airways", route: "LHR → ATH", duration: "3h 55m", pricePerHead: "£195" },
    ],
    highlights: ["Acropolis", "Aegina", "Anafiotika"],
  },
  {
    slug: "bali",
    city: "Bali",
    country: "Indonesia",
    iata: "DPS",
    tagline: "Surf at dawn, rice terraces by sunset.",
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
    fullSchedule: [
      {
        day: "Day 1 · Sat",
        place: "Canggu arrival",
        note: "Land in Denpasar. Pool villa five minutes from Echo Beach. First sunset at La Brisa, first Bintang on the sand.",
      },
      {
        day: "Day 2 · Sun",
        place: "Surf + smoothies",
        note: "Beginners' lesson at Old Man's, 06:30 set. Açaí bowls at Crate. Afternoon massage at Spring Spa.",
      },
      {
        day: "Day 3 · Mon",
        place: "Uluwatu day",
        note: "Scooter down to the cliffs. Lunch at Single Fin watching the surf. Sunset at Suluban. Dinner at Sundara.",
      },
      {
        day: "Day 4 · Tue",
        place: "Ubud transfer",
        note: "Drive up via Tanah Lot for the temple at sunset. Rice-terrace villa above Ubud. Slow dinner at Locavore To Go in Penestanan.",
      },
      {
        day: "Day 5 · Wed",
        place: "Tegallalang + yoga",
        note: "Sunrise yoga at the villa. Walk the Tegallalang rice terraces before the bus tours arrive. Coffee at Karsa Kafe.",
      },
      {
        day: "Day 6 · Thu",
        place: "Mount Batur sunrise",
        note: "Pre-dawn drive to Kintamani. Hike Batur for sunrise. Hot springs at Toya Devasya. Long nap. Dinner at Mosaic.",
      },
      {
        day: "Day 7 · Fri",
        place: "Sidemen + waterfalls",
        note: "Drive east to Sidemen. Rice-paddy walk. Tukad Cepung waterfall. Stay over at a riverside lodge.",
      },
      {
        day: "Day 8 · Sat",
        place: "Back to the beach",
        note: "Drive back to Canggu via Sanur. Last surf, last smoothie. Final dinner at La Baracca on the beach.",
      },
      {
        day: "Day 9 · Sun",
        place: "Last swim, fly home",
        note: "Sunrise at Echo. Pack slow. Late check-out. Evening flight from Denpasar.",
      },
    ],
    bookings: [
      { category: "flights", label: "Return flights · LHR ↔ DPS", detail: "Singapore Airlines · 17h via SIN · £820pp" },
      { category: "stay", label: "Canggu pool villa", detail: "4 nights · private pool · £75pp/night" },
      { category: "stay", label: "Ubud rice-terrace villa", detail: "4 nights · open-air · £85pp/night" },
      { category: "activity", label: "Old Man's surf lesson · 6 boards", detail: "Sunday 06:30 · £30pp" },
      { category: "activity", label: "Mount Batur sunrise hike", detail: "Thursday · 02:30 pickup · £55pp" },
      { category: "transport", label: "Ubud → Sidemen → Canggu driver", detail: "3-day private driver · £40pp total" },
    ],
    stays: [
      {
        name: "The Slow",
        neighbourhood: "Canggu, Batu Bolong",
        pricePerNight: "£90pp",
        rating: "4.8",
        photoUrl: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    flights: [
      { carrier: "Singapore Airlines", route: "LHR → SIN → DPS", duration: "17h 25m", pricePerHead: "£820" },
      { carrier: "Qatar Airways", route: "LHR → DOH → DPS", duration: "18h 50m", pricePerHead: "£760" },
    ],
    highlights: ["Canggu", "Echo Beach", "Ubud"],
  },
  {
    slug: "lagos",
    city: "Lagos",
    country: "Nigeria",
    iata: "LOS",
    tagline: "Live bands, beach boats, never sleep.",
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
    fullSchedule: [
      {
        day: "Day 1 · Sat",
        place: "Victoria Island arrival",
        note: "Land at LOS. Apartment on Victoria Island. First night easy at La Veranda. Beach club on the lagoon, Afrobeats till late.",
      },
      {
        day: "Day 2 · Sun",
        place: "Lekki + suya",
        note: "Lekki Arts and Crafts Market in the morning. Lunch at Yellow Chilli. Suya at Glover Court for dinner. Live band at Hard Rock.",
      },
      {
        day: "Day 3 · Mon",
        place: "Tarkwa Bay",
        note: "Boat across from Five Cowrie Creek. Beach all day, fresh fish on the sand. Reggae night at Bogobiri House.",
      },
      {
        day: "Day 4 · Tue",
        place: "Lekki Conservation",
        note: "Canopy walk in the morning, longest in Africa. Lunch at RSVP. Afrobeats concert at Eko Hotel — flagship Detty December slot.",
      },
      {
        day: "Day 5 · Wed",
        place: "Nike Art + Lagos Island",
        note: "Nike Art Gallery, all four floors. Lunch at Nok by Alara. Sunset boat through Lagos Marina. Dinner at Slow Bar.",
      },
      {
        day: "Day 6 · Thu",
        place: "Pool day · Inagbe",
        note: "Speedboat to Inagbe Resort. Pool, lagoon, jollof, repeat. Back to the mainland for the headliner at Landmark Beach.",
      },
      {
        day: "Day 7 · Fri",
        place: "Friday is for Lagos",
        note: "Late brunch at Cactus. Salsa class at Quilox. Sundown rooftop at The George. Big night at Quilox.",
      },
      {
        day: "Day 8 · Sat",
        place: "Last meal, fly home",
        note: "Slow brunch at Talindo Steakhouse. Last shopping at Lekki market. Evening flight back to LHR.",
      },
    ],
    bookings: [
      { category: "flights", label: "Return flights · LHR ↔ LOS", detail: "British Airways direct · 6h 30m · £640pp" },
      { category: "stay", label: "Victoria Island serviced apartment", detail: "7 nights · pool · £80pp/night" },
      { category: "activity", label: "Detty December headliner · Eko Hotel", detail: "Tuesday · standing · £75pp · book 8 weeks out" },
      { category: "activity", label: "Inagbe Resort speedboat day", detail: "Thursday · 09:00 pickup · £45pp" },
      { category: "dinner", label: "Slow Bar, Lagos Island", detail: "Wednesday · 20:00 · book 1 week out" },
      { category: "transport", label: "Private driver · 7 days", detail: "10-hour daily window · £55pp total" },
    ],
    stays: [
      {
        name: "Eko Pearl Towers",
        neighbourhood: "Eko Atlantic, beachfront",
        pricePerNight: "£95pp",
        rating: "4.7",
        photoUrl: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    flights: [
      { carrier: "British Airways", route: "LHR → LOS", duration: "6h 30m", pricePerHead: "£640" },
      { carrier: "Virgin Atlantic", route: "LHR → LOS", duration: "6h 25m", pricePerHead: "£610" },
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
