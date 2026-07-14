import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrComputeScore } from "@/lib/compatibility";
import { listingSchema } from "@/lib/validation";
import type { Listing, InterestStatus } from "@/lib/types";

/**
 * GET /api/listings
 *   ?mine=1                       -> owner's own listings (any status)
 *   ?location=&minBudget=&maxBudget=  -> active listings, and for a tenant each
 *                                        carries a compatibility score, ranked desc.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);

  // Owner: manage own listings.
  if (searchParams.get("mine") === "1") {
    const { data } = await admin
      .from("listings")
      .select("*")
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ listings: data ?? [] });
  }

  // Browse active listings with optional filters.
  let query = admin.from("listings").select("*").eq("status", "active");
  const location = searchParams.get("location");
  if (location) query = query.ilike("location", `%${location}%`);
  const minBudget = searchParams.get("minBudget");
  if (minBudget) query = query.gte("rent", Number(minBudget));
  const maxBudget = searchParams.get("maxBudget");
  if (maxBudget) query = query.lte("rent", Number(maxBudget));

  const { data } = await query.order("created_at", { ascending: false });
  const rows = (data ?? []) as Listing[];

  // Tenants get scored + ranked results; also mark listings they already acted on.
  if (auth.profile.role === "tenant") {
    const { data: myInterests } = await admin
      .from("interests")
      .select("listing_id,status")
      .eq("tenant_id", auth.user.id);
    const interestMap = new Map<string, InterestStatus>(
      (myInterests ?? []).map((i) => [i.listing_id as string, i.status as InterestStatus])
    );

    const scored = await Promise.all(
      rows.map(async (l) => {
        const s = await getOrComputeScore(auth.user.id, l.id);
        return {
          ...l,
          score: s.score,
          explanation: s.explanation,
          method: s.method,
          interest_status: interestMap.get(l.id) ?? null,
        };
      })
    );
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return NextResponse.json({ listings: scored });
  }

  return NextResponse.json({
    listings: rows.map((l) => ({
      ...l,
      score: null,
      explanation: null,
      method: null,
      interest_status: null,
    })),
  });
}

/** POST /api/listings — owner creates a room listing. */
export async function POST(request: Request) {
  const auth = await requireRole("owner");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .insert({
      owner_id: auth.user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      location: parsed.data.location,
      rent: parsed.data.rent,
      available_from: parsed.data.available_from || null,
      room_type: parsed.data.room_type,
      furnishing_status: parsed.data.furnishing_status,
      photos: parsed.data.photos ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listing: data });
}
