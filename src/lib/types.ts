export type Profile = {
  id: string;
  name: string;
  joined_at: string;
};

export type Trip = {
  id: string;
  slug: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  target_crew_size: number;
  created_at: string;
};

export type TripMember = {
  trip_id: string;
  user_id: string;
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

export type CrewMember = Profile & {
  member_joined_at: string;
};

export type ExpenseWithPayer = Expense & {
  payer_name: string;
};

export type PostWithAuthor = Post & {
  author_name: string;
};

export const TRIP_SLUG = "stockholm-2026";
