export const DEFAULT_SPEC_LABELS = [
  "Base",
  "Flights",
  "Per head",
  "The rule",
] as const;

export type DefaultSpecLabel = (typeof DEFAULT_SPEC_LABELS)[number];
