export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

export type Profile = {
  id: string;
  name: string;
  joined_at: string;
  trial_started_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: SubscriptionStatus | null;
  current_period_end: string | null;
  is_founder: boolean;
  founding_crew_at: string | null;
  pricing_grandfathered_at: string | null;
};

export type TripStatus = "planning" | "locked";
export type TripRole = "admin" | "member";

export type SpecItem = {
  label: string;
  value: string;
  sub: string;
  // Authoritative numeric when the cell is monetary (e.g. "Per head").
  // When present, value is a derived display string kept in sync for
  // legacy reads but never authoritative. Symbol comes from trip.currency.
  amount?: number | null;
};
export type ScheduleItemPlace = {
  name: string;
  place_id: string | null;
  maps_url: string | null;
  website_url: string | null;
};

export type ScheduleItem = {
  day_label: string;
  heading: string;
  body: string;
  // Optional during the rollout window so existing rows without
  // `places` still render. Always written by Lock & Draft after
  // Phase 1 Task 5.
  places?: ScheduleItemPlace[];
};
export type SectionLeadKey =
  | "overview"
  | "shortlist"
  | "bookings"
  | "ledger"
  | "feed";
export type SectionLeads = Partial<Record<SectionLeadKey, string>>;

export type AiOriginAirport = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  // IATA metro code (LON, NYC, PAR…) when the user picked a "city — all
  // airports" option. When present, the AI uses the metro in the flights
  // cell ("LON → ARN") instead of committing to a single airport.
  metro?: string | null;
  metroAirports?: string[] | null;
};

export type AiBudgetTier = "tight" | "mid" | "lavish" | "custom";

export const BUDGET_TIER_LABELS: Record<AiBudgetTier, string> = {
  tight: "Tight",
  mid: "Comfortable",
  lavish: "Lavish",
  custom: "Custom",
};

// Vibe tags are picked by the crew at lock time and shape every AI output.
// Each tag must be a *specific* signal the AI can act on differently — see
// VIBE_INSTRUCTIONS in src/lib/ai/vibeMap.ts for the per-tag prompt and
// Places-fetch contract. Catchall tags that duplicate a group name are
// banned (e.g. no "culture" tag inside a "Culture" group).
export type AiVibeTag =
  // Pace
  | "chill"
  | "active"
  | "adventure"
  | "sport"
  // Setting
  | "beach"
  | "mountains"
  | "nature"
  | "city"
  // Food
  | "foodie"
  | "street_food"
  | "wine"
  // After dark
  | "party"
  | "bars"
  | "live_music"
  // Culture
  | "art"
  | "history"
  | "architecture"
  // Mood
  | "romantic"
  | "family_friendly"
  | "luxury"
  | "wellness"
  | "photogenic";

export const VIBE_LABELS: Record<AiVibeTag, string> = {
  chill: "Chill",
  active: "Active",
  adventure: "Adventure",
  sport: "Sports",
  beach: "Beach",
  mountains: "Mountains",
  nature: "Nature",
  city: "City",
  foodie: "Foodie",
  street_food: "Street food",
  wine: "Wine",
  party: "Party",
  bars: "Bars",
  live_music: "Live music",
  art: "Art & galleries",
  history: "History",
  architecture: "Architecture",
  romantic: "Romantic",
  family_friendly: "Family-friendly",
  luxury: "Luxury",
  wellness: "Wellness",
  photogenic: "Photogenic",
};

export type AiOccasion =
  | "group_holiday"
  | "birthday"
  | "anniversary"
  | "honeymoon"
  | "babymoon"
  | "engagement"
  | "hen_do"
  | "stag_do"
  | "family"
  | "graduation"
  | "reunion"
  | "corporate_retreat"
  | "guys_trip"
  | "girls_trip"
  | "couples_trip";

export const OCCASION_LABELS: Record<AiOccasion, string> = {
  group_holiday: "Group holiday",
  birthday: "Birthday",
  anniversary: "Anniversary",
  honeymoon: "Honeymoon",
  babymoon: "Babymoon",
  engagement: "Engagement",
  hen_do: "Hen do",
  stag_do: "Stag do",
  family: "Family",
  graduation: "Graduation",
  reunion: "Reunion",
  corporate_retreat: "Corporate retreat",
  guys_trip: "Guys trip",
  girls_trip: "Girls trip",
  couples_trip: "Couples trip",
};

// Pinned moment: a structured anchor the AI must build the plan around
// (e.g. "Watch FC Barcelona at Camp Nou, Saturday evening — must-do").
// Up to 5 per trip; honoured by the enriched-tier draft only.
export type TripPin = {
  title: string;
  when: string | null;
  date: string | null;
  priority: "must" | "nice";
  notes: string | null;
};

export type AiPreferences = {
  origin: AiOriginAirport | null;
  crew_size: number;
  budget_tier: AiBudgetTier;
  budget_custom_pp: number | null;
  vibes: AiVibeTag[];
  occasion?: AiOccasion;
  notes?: string;
  pins?: TripPin[];
};

export type PolaroidSourceType =
  | "destination"
  | "activity"
  | "post"
  | "upload";

export type PolaroidOverride = {
  index: number;
  imageUrl: string;
  caption?: string | null;
  subcaption?: string | null;
  sourceType: PolaroidSourceType;
  sourceId?: string | null;
};

export type Money = { amount: number; currency: string };

export type SerpErrorCode =
  | "timeout"
  | "rate_limit"
  | "parse_error"
  | "no_results"
  | "provider_error"
  | "missing_input"
  | "monthly_budget_cap";

export type ErrorEnvelope = {
  code: SerpErrorCode;
  message: string;
  occurred_at: string;
};

export type FareOption = {
  airline: string;
  airline_logo_url: string | null;
  price: Money;
  duration_minutes: number;
  stops: number;
  depart_iso: string;
  arrive_iso: string;
  deeplink: string;
};

export type HotelQuote = {
  name: string;
  place_id: string | null;
  rating: number | null;
  price_per_night: Money;
  total_price: Money;
  thumbnail_url: string | null;
  deeplink: string;
};

export type FlightPricing = {
  // Pre-existing fields preserved so existing readers keep working.
  low: number;
  high: number;
  currency: string;
  provider: "serpapi-google-flights";
  refreshed_at: string;
  origin_iata: string;
  destination_iata: string;
  best_price?: Money;
  options?: FareOption[];
  fallback_deeplink?: string;
  fetch_error?: ErrorEnvelope | null;
};

export type HotelPricing = {
  quotes: HotelQuote[];
  refreshed_at: string;
  provider: "serpapi-google-hotels";
  fetch_error: ErrorEnvelope | null;
};

// Flight + hotel quotes from SerpApi. Both are optional so partial
// success (one side fetched, the other failed) round-trips cleanly.
export type LivePricing = {
  flights?: FlightPricing;
  hotels?: HotelPricing;
};

export type DraftStage =
  | "places"
  | "weather"
  | "drafting"
  | "validating"
  | "saving"
  | "done";

export type DraftProgress = {
  stage: DraftStage;
  startedAt: string;
  detail?: string;
  error?: { message: string; retryable: boolean };
};

export type TripMeta = {
  spec_grid?: SpecItem[];
  schedule?: ScheduleItem[];
  section_leads?: SectionLeads;
  ai_preferences?: AiPreferences;
  polaroid_slots?: PolaroidOverride[];
  // Set whenever brief, prefs, or pins are edited. Compared against
  // `enriched_draft_generated_at` to detect "plan is stale" — drives the
  // "Regenerate plan" banner on the trip overview.
  brief_updated_at?: string;
  live_pricing?: LivePricing;
  // Live progress for an in-flight Lock & Draft. Cleared on success.
  // On failure, stage stays + error is set so the client can render
  // a Retry button with the actual reason.
  draft_progress?: DraftProgress;
};

export type Trip = {
  id: string;
  slug: string;
  name: string;
  status: TripStatus;
  destination: string | null;
  vote_deadline: string | null;
  created_by: string | null;
  meta: TripMeta;
  start_date: string | null;
  end_date: string | null;
  target_crew_size: number | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  city_label: string | null;
  dates_label: string | null;
  target_budget_pp: number | null;
  // Nullable to tolerate a period where the `currency` column has not
  // yet been migrated in. Display helpers default to GBP when absent.
  currency: string | null;
  ai_drafted_at: string | null;
  hero_image_url: string | null;
  hero_image_attribution: string | null;
  hero_image_user_url: string | null;
  hero_tint: string | null;
  enriched_draft: unknown | null;
  enriched_draft_tier: "basic" | "enriched" | null;
  enriched_draft_generated_at: string | null;
  last_price_refresh_at: string | null;
  created_at: string;
};

export type TripMember = {
  trip_id: string;
  user_id: string;
  role: TripRole;
  invited_by: string | null;
  joined_at: string;
};

export type Activity = {
  id: string;
  trip_id: string;
  title: string;
  meta: string | null;
  category: "day" | "night";
  position: number;
  ai_drafted: boolean;
  photo_url: string | null;
  photo_attribution: string | null;
  rating: number | null;
  price_level: number | null;
  website_url: string | null;
  place_id: string | null;
  maps_url: string | null;
  created_at: string;
};

export type Vote = {
  activity_id: string;
  user_id: string;
  vote: "yes" | "maybe" | "no";
  updated_at: string;
};

export type Booking = {
  id: string;
  trip_id: string;
  title: string;
  assignee_id: string | null;
  done: boolean;
  position: number;
  ai_drafted: boolean;
  created_at: string;
  created_by: string | null;
  place_id: string | null;
  maps_url: string | null;
  website_url: string | null;
  // Admin override; takes precedence over place_id-derived URLs at render time.
  custom_url: string | null;
};

export type Expense = {
  id: string;
  trip_id: string;
  description: string;
  amount: string;
  paid_by: string;
  created_at: string;
};

export type Post = {
  id: string;
  trip_id: string;
  image_url: string | null;
  caption: string | null;
  author_id: string;
  created_at: string;
  reply_to_post_id: string | null;
  edited_at: string | null;
};

export type PostLike = {
  post_id: string;
  user_id: string;
  created_at: string;
};

export type DestinationCandidate = {
  id: string;
  trip_id: string;
  title: string;
  note: string | null;
  proposed_by: string | null;
  position: number;
  created_at: string;
  mapbox_id: string | null;
  longitude: number | null;
  latitude: number | null;
  country: string | null;
  photo_url: string | null;
  photo_attribution: string | null;
  basic_draft: unknown | null;
  basic_draft_generated_at: string | null;
};

export type DestinationVote = {
  candidate_id: string;
  user_id: string;
  vote: "yes" | "maybe" | "no";
  updated_at: string;
};

export type TripInvite = {
  id: string;
  trip_id: string;
  email: string | null;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  token: string | null;
  expires_at: string | null;
  accepted_by: string | null;
};

export type CrewMember = Profile & {
  member_joined_at: string;
  role: TripRole;
};

export type ExpenseWithPayer = Expense & {
  payer_name: string;
};

export type PostWithAuthor = Post & {
  author_name: string;
};

export type AiProvider = "gemini" | "claude";

export type AiUsage = {
  id: string;
  user_id: string | null;
  trip_id: string;
  operation: string;
  provider: AiProvider;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  thinking_tokens: number | null;
  ai_cost_usd: string | null;
  places_requests: number | null;
  places_cost_usd: string | null;
  total_cost_usd: string | null;
  created_at: string;
};

export type NotificationKind =
  | "crew_joined"
  | "destination_locked"
  | "trip_drafted"
  | "expense_added"
  | "role_changed"
  | "candidate_proposed"
  | "feed_message";

export type NotificationPayload = {
  actor_name?: string;
  trip_name?: string;
  trip_slug?: string;
  destination?: string;
  candidate_title?: string;
  expense_description?: string;
  expense_amount?: string;
  expense_currency?: string;
  new_role?: "admin" | "member" | "removed";
  // feed_message
  post_id?: string;
  reply_to_post_id?: string | null;
  reply_to_author_id?: string | null;
  excerpt?: string;
};

export type TripNotificationPrefs = {
  trip_id: string;
  user_id: string;
  feed_muted: boolean;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  trip_id: string | null;
  kind: NotificationKind;
  actor_id: string | null;
  entity_id: string | null;
  payload: NotificationPayload;
  read_at: string | null;
  created_at: string;
};

export type ApplicationTripsPerYear = "0" | "1" | "2-3" | "4+";
export type ApplicationRole = "organiser" | "attendee" | "depends";
export type ApplicationPain = "dates" | "booking" | "money" | "plan" | "chaos";
export type ApplicationBudgetAttitude =
  | "monopoly"
  | "splurge"
  | "count"
  | "depends";

export type Application = {
  id: string;
  email: string;
  created_at: string;
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  approved_at: string | null;
  approved_by: string | null;
  invite_token: string | null;
  invite_sent_at: string | null;
  user_id: string | null;
  activated_at: string | null;
  first_trip_at: string | null;
  first_lock_at: string | null;
  first_paid_at: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  admin_notes: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  draft_lead_id: string | null;
  provisional_decision: "approve" | "reject" | null;
  auto_decision_at: string | null;
  decision_finalised_at: string | null;
  decision_finalised_by: "admin" | "cron" | null;
};

export type TeaserInputs = {
  origin: string;
  crew: "2" | "3-4" | "5-6" | "7+";
  when: "weekend" | "week" | "two-weeks" | "flexible";
  budget: "500" | "1000" | "1500" | "2000+";
};

import type { TeaserOutput } from "@/lib/ai/teaserSchema";
export type { TeaserOutput };

export type DraftLead = {
  id: string;
  email: string;
  ip_hash: string;
  slug: string;
  inputs: TeaserInputs;
  teaser: TeaserOutput | null;
  cache_key: string;
  resume_token: string;
  nudge_sent_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

export type ConciergeProposal =
  | {
      kind: "activity_add";
      payload: {
        name: string;
        description: string;
        location?: string;
        day?: number;
      };
      applied_at?: string;
    }
  | {
      kind: "schedule_revise";
      payload: {
        day: number;
        slots: { time: string; title: string; note?: string }[];
      };
      applied_at?: string;
    }
  | {
      kind: "budget_change";
      payload: {
        new_target_pp: number;
        currency: string;
        reason: string;
      };
      applied_at?: string;
    };

export type ConciergeMessage = {
  id: string;
  trip_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  proposals: ConciergeProposal[] | null;
  token_in: number | null;
  token_out: number | null;
  created_at: string;
};
