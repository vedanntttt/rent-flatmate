import OpenAI from "openai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRent } from "@/lib/utils";
import type {
  CompatibilityScore,
  Listing,
  ScoreMethod,
  TenantProfile,
} from "@/lib/types";

export interface ScoreResult {
  score: number;
  explanation: string;
  method: ScoreMethod;
}

// ---------------------------------------------------------------------------
// LLM prompt (kept here and documented in the README).
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT =
  "You are a rental compatibility scoring engine for a flatmate-finder app. " +
  "Given a room listing and a tenant's 'looking for a room' profile, compute a " +
  "compatibility score from 0 to 100 based primarily on how well BUDGET and " +
  "LOCATION match, and secondarily on move-in timing and room details. " +
  'Respond with STRICT JSON only, no prose: {"score": <number 0-100>, "explanation": <string, one or two sentences>}.';

function buildUserPrompt(tenant: TenantProfile, listing: Listing): string {
  const payload = {
    room_listing: {
      location: listing.location,
      rent: listing.rent,
      room_type: listing.room_type,
      furnishing_status: listing.furnishing_status,
      available_from: listing.available_from,
    },
    tenant_profile: {
      preferred_location: tenant.preferred_location,
      budget_min: tenant.budget_min,
      budget_max: tenant.budget_max,
      move_in_date: tenant.move_in_date,
    },
  };
  return (
    "Given this room listing: " +
    JSON.stringify(payload.room_listing) +
    " and this tenant profile: " +
    JSON.stringify(payload.tenant_profile) +
    " compute a compatibility score from 0 to 100 based on budget and location match. " +
    'Return JSON: { "score": number, "explanation": string }'
  );
}

const llmResponseSchema = z.object({
  score: z.number(),
  explanation: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Rule-based fallback — deterministic, no network. 50pts location + 50pts budget.
// ---------------------------------------------------------------------------
export function ruleBasedScore(
  tenant: TenantProfile,
  listing: Listing
): ScoreResult {
  // Budget component (0-50)
  const rent = listing.rent;
  let budgetScore: number;
  let budgetNote: string;
  if (rent >= tenant.budget_min && rent <= tenant.budget_max) {
    budgetScore = 50;
    budgetNote = `rent ${formatRent(rent)} fits the ${formatRent(
      tenant.budget_min
    )}–${formatRent(tenant.budget_max)} budget`;
  } else if (rent < tenant.budget_min) {
    budgetScore = 45;
    budgetNote = `rent ${formatRent(rent)} is below the budget range (great value)`;
  } else {
    const over = (rent - tenant.budget_max) / Math.max(tenant.budget_max, 1);
    budgetScore = Math.max(0, Math.round(50 * (1 - over)));
    budgetNote = `rent ${formatRent(rent)} is ${Math.round(
      over * 100
    )}% over the max budget`;
  }

  // Location component (0-50)
  const a = tenant.preferred_location.trim().toLowerCase();
  const b = listing.location.trim().toLowerCase();
  let locationScore: number;
  let locationNote: string;
  if (a === b) {
    locationScore = 50;
    locationNote = `location "${listing.location}" is an exact match`;
  } else if (a.length > 0 && (b.includes(a) || a.includes(b))) {
    locationScore = 40;
    locationNote = `location "${listing.location}" overlaps the preferred area`;
  } else {
    const aTokens = new Set(a.split(/[\s,]+/).filter(Boolean));
    const bTokens = b.split(/[\s,]+/).filter(Boolean);
    const overlap = bTokens.filter((t) => aTokens.has(t)).length;
    const ratio = overlap / Math.max(aTokens.size, 1);
    locationScore = Math.round(50 * ratio * 0.8);
    locationNote =
      overlap > 0
        ? `partial location overlap with "${listing.location}"`
        : `location "${listing.location}" differs from preferred "${tenant.preferred_location}"`;
  }

  const score = Math.max(0, Math.min(100, budgetScore + locationScore));
  return {
    score,
    explanation: `Rule-based match — ${locationNote}; ${budgetNote}.`,
    method: "rule",
  };
}

// ---------------------------------------------------------------------------
// LLM scoring via Groq (OpenAI-compatible API). Returns null on any failure.
// ---------------------------------------------------------------------------
export async function llmScore(
  tenant: TenantProfile,
  listing: Listing
): Promise<ScoreResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 12000,
      maxRetries: 1,
    });

    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(tenant, listing) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = llmResponseSchema.parse(JSON.parse(raw));
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    return { score, explanation: parsed.explanation.trim(), method: "llm" };
  } catch (err) {
    console.error("[compatibility] LLM scoring failed, using fallback:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache-aware entry point. Computes once per (tenant, listing) pair and stores
// the result so it is never recomputed on subsequent requests.
// ---------------------------------------------------------------------------
export async function getOrComputeScore(
  tenantId: string,
  listingId: string
): Promise<ScoreResult> {
  const admin = createAdminClient();

  // 1. Return cached score if present.
  const { data: cached } = await admin
    .from("compatibility_scores")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (cached) {
    const row = cached as CompatibilityScore;
    return { score: row.score, explanation: row.explanation, method: row.method };
  }

  // 2. Load the inputs.
  const [{ data: tenant }, { data: listing }] = await Promise.all([
    admin.from("tenant_profiles").select("*").eq("user_id", tenantId).maybeSingle(),
    admin.from("listings").select("*").eq("id", listingId).maybeSingle(),
  ]);

  if (!listing) {
    return {
      score: 0,
      explanation: "Listing not found.",
      method: "rule",
    };
  }

  // No tenant profile yet -> transient result, do not cache (so it recomputes
  // once the tenant fills in preferences).
  if (!tenant) {
    return {
      score: 0,
      explanation: "Complete your tenant profile to get a compatibility score.",
      method: "rule",
    };
  }

  const tp = tenant as TenantProfile;
  const li = listing as Listing;

  // 3. Try the LLM, fall back to the rule-based score.
  const result = (await llmScore(tp, li)) ?? ruleBasedScore(tp, li);

  // 4. Persist (ignore duplicate races via upsert on the unique pair).
  await admin.from("compatibility_scores").upsert(
    {
      tenant_id: tenantId,
      listing_id: listingId,
      score: result.score,
      explanation: result.explanation,
      method: result.method,
    },
    { onConflict: "tenant_id,listing_id", ignoreDuplicates: true }
  );

  return result;
}
