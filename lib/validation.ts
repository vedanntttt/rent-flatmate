import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Name is required"),
  role: z.enum(["tenant", "owner"]),
});

export const accountSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  age: z
    .number()
    .int()
    .min(16, "Age must be at least 16")
    .max(120, "Age must be 120 or less")
    .nullable()
    .optional(),
});

export const tenantProfileSchema = z.object({
  preferred_location: z.string().min(1, "Preferred location is required"),
  budget_min: z.coerce.number().int().min(0),
  budget_max: z.coerce.number().int().min(0),
  move_in_date: z.string().optional().nullable(),
}).refine((d) => d.budget_max >= d.budget_min, {
  message: "Max budget must be greater than or equal to min budget",
  path: ["budget_max"],
});

export const listingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  rent: z.coerce.number().int().min(0),
  available_from: z.string().optional().nullable(),
  room_type: z.string().min(1),
  furnishing_status: z.string().min(1),
  photos: z.array(z.string().url()).optional().default([]),
});

export const interestSchema = z.object({
  listing_id: z.string().uuid(),
});

export const interestDecisionSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

export const messageSchema = z.object({
  interest_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
