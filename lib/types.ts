// Shared domain types mirroring the Postgres schema in supabase/schema.sql.

export type Role = "tenant" | "owner" | "admin";
export type ListingStatus = "active" | "filled";
export type InterestStatus = "pending" | "accepted" | "declined";
export type ScoreMethod = "llm" | "rule";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  age: number | null;
  email: string | null;
  created_at: string;
}

export interface TenantProfile {
  id: string;
  user_id: string;
  preferred_location: string;
  budget_min: number;
  budget_max: number;
  move_in_date: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  location: string;
  rent: number;
  available_from: string | null;
  room_type: string;
  furnishing_status: string;
  photos: string[];
  status: ListingStatus;
  created_at: string;
}

export interface CompatibilityScore {
  id: string;
  tenant_id: string;
  listing_id: string;
  score: number;
  explanation: string;
  method: ScoreMethod;
  created_at: string;
}

export interface Interest {
  id: string;
  tenant_id: string;
  listing_id: string;
  status: InterestStatus;
  created_at: string;
}

export interface Message {
  id: string;
  interest_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

// Convenience shapes used by API responses / UI.
export interface ListingWithScore extends Listing {
  score: number | null;
  explanation: string | null;
  method: ScoreMethod | null;
  interest_status?: InterestStatus | null;
  owner?: Pick<Profile, "id" | "full_name" | "email">;
}

export interface InterestDetail extends Interest {
  listing: Listing;
  tenant: Pick<Profile, "id" | "full_name" | "email">;
  score: number | null;
  explanation: string | null;
}
