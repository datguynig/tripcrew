export const TRIP_START = "2026-07-23";
export const TRIP_END = "2026-07-26";
export const TARGET_CREW = 5;
export const TARGET_BUDGET_PP = 950;

export const HERO_SUB =
  "Three nights. Five of us. One city built on fourteen islands. Base camp on Södermalm, days on the water, nights that go somewhere. Book early, drink smarter, show up.";

export const SECTION_LEADS = {
  overview:
    "Södermalm apartment. Archipelago days. Trädgården nights. Low-key Thursday, water Friday, dressed-up Saturday, brunch Sunday.",
  shortlist:
    "Vote yes, meh, or no. Ranked by consensus. Stuff the crew wants floats up. Tap twice to clear.",
  bookings: "The checklist. Claim one, book it, tick it. Simple accountability.",
  ledger:
    "Pool everything, split even. Log what you pay, balances update. Settle on the flight home.",
  feed: "Photos and dispatches from the trip. Paste an image URL, add a line, post. Build the record as you go.",
} as const;

export type SpecCell = {
  label: string;
  value: string;
  sub: string;
};

export const SPEC: SpecCell[] = [
  { label: "Base", value: "3-bed Airbnb", sub: "Södermalm, SoFo area" },
  {
    label: "Flights",
    value: "LHR → ARN",
    sub: "SAS or BA direct · 2h 20m",
  },
  { label: "Per head", value: "£950", sub: "Everything in, ex. flights" },
  {
    label: "The rule",
    value: "Systembolaget by Fri 3pm",
    sub: "State off-licence, closes early",
  },
];

export type ScheduleRow = {
  day: string;
  head: string;
  body: string;
};

export const SCHEDULE: ScheduleRow[] = [
  {
    day: "THU / 23",
    head: "Land, settle, starters",
    body: "Lunch at Urban Deli. Sunset at Monteliusvägen. Rooftop at Takparken. Meatballs for the People. Light first night at Häktet.",
  },
  {
    day: "FRI / 24",
    head: "Water by day. Trädgården by night.",
    body: "Kayak the inner archipelago. Swim off Skinnarviksberget. Pelikan for Swedish classics. Tjoget for cocktails. Trädgården until three.",
  },
  {
    day: "SAT / 25",
    head: "Culture, dress code, big one.",
    body: "Vasa Museum, then Gröna Lund for rides and a concert. Dinner at Kagges. Pharmarium in Gamla Stan. Berns late.",
  },
  {
    day: "SUN / 26",
    head: "Recover, fly home.",
    body: "Rooftop brunch at Fotografiska. Arlanda Express to the airport.",
  },
];
