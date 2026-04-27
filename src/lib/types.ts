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
export type ScheduleItem = { day_label: string; heading: string; body: string };
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

export type AiVibeTag =
  // Pace
  | "chill"
  | "active"
  | "adventure"
  // Setting
  | "beach"
  | "outdoors"
  | "nature"
  | "urban"
  // Food / drink
  | "foodie"
  | "nightlife"
  | "party"
  // Culture
  | "culture"
  | "art"
  | "historic"
  // Vibe
  | "romantic"
  | "family_friendly"
  | "luxury"
  | "wellness"
  // Special
  | "photogenic"
  | "sport"
  | "music";

export const VIBE_LABELS: Record<AiVibeTag, string> = {
  chill: "Chill",
  active: "Active",
  adventure: "Adventure",
  beach: "Beach",
  outdoors: "Outdoors",
  nature: "Nature",
  urban: "Urban",
  foodie: "Foodie",
  nightlife: "Nightlife",
  party: "Party",
  culture: "Culture",
  art: "Art & galleries",
  historic: "Historic",
  romantic: "Romantic",
  family_friendly: "Family-friendly",
  luxury: "Luxury",
  wellness: "Wellness",
  photogenic: "Photogenic",
  sport: "Sports",
  music: "Music & festivals",
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

// Flight (and later, hotel) pricing fetched from a real provider.
// Replaces the AI's vibes-based estimate in the budget block when present.
export type LivePricing = {
  flights?: {
    low: number;
    high: number;
    currency: string;
    provider: "serpapi-google-flights";
    refreshed_at: string;
    origin_iata: string;
    destination_iata: string;
  };
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
