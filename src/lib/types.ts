export type Profile = {
  id: string;
  name: string;
  joined_at: string;
};

export type TripStatus = "planning" | "locked";
export type TripRole = "admin" | "member";

export type SpecItem = { label: string; value: string; sub: string };
export type ScheduleItem = { day_label: string; heading: string; body: string };
export type SectionLeadKey =
  | "overview"
  | "shortlist"
  | "bookings"
  | "ledger"
  | "feed";
export type SectionLeads = Partial<Record<SectionLeadKey, string>>;

export type TripMeta = {
  spec_grid?: SpecItem[];
  schedule?: ScheduleItem[];
  section_leads?: SectionLeads;
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
};

export type DestinationCandidate = {
  id: string;
  trip_id: string;
  title: string;
  note: string | null;
  proposed_by: string | null;
  position: number;
  created_at: string;
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
  email: string;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
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
