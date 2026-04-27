// The Lisbon trip used as the canonical sample across the landing page,
// the inline SampleTripTile, and the public /sample-trip/[slug] route.
// Single source of truth so a copy change here propagates everywhere.

export type SampleSpecCell = {
  label: string;
  value: string;
};

export type SampleScheduleRow = {
  day: string;
  place: string;
  note: string;
};

export const SAMPLE_LISBON = {
  city: "Lisbon",
  datesLabel: "Jun 14 — Jun 19",
  durationLabel: "6 days",
  crewLabel: "6 crew",
  vibesLabel: "Foodie · Wine",
  vibesPlusLabel: "Foodie + Wine",
  totalDays: 6,
  visibleDays: 3,
  specCells: [
    { label: "Per head", value: "£820" },
    { label: "Crew", value: "6" },
    { label: "From", value: "LHR" },
    { label: "Vibes", value: "Foodie · Wine" },
  ] as const satisfies readonly SampleSpecCell[],
  schedule: [
    {
      day: "Day 1",
      place: "Time Out Market",
      note: "Drop bags at the apartment in Príncipe Real. Walk down to Cais do Sodré.",
    },
    {
      day: "Day 2",
      place: "Belém Tower + Pastéis de Belém",
      note: "Tram 15 from Praça do Comércio. Custards before the queue builds.",
    },
    {
      day: "Day 3",
      place: "Sintra day trip",
      note: "Train from Rossio. Pena Palace booked for 11. Cabo da Roca on the way back.",
    },
  ] as const satisfies readonly SampleScheduleRow[],
  polaroidCaptions: [
    "Time Out Market",
    "Pastéis de Belém",
    "Pena Palace",
  ] as const,
} as const;
