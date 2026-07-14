import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrComputeScore } from "@/lib/compatibility";
import { interestSchema } from "@/lib/validation";
import { highScoreInterestEmail, sendEmail } from "@/lib/email";
import type { Listing } from "@/lib/types";

const HIGH_SCORE_THRESHOLD = 80;

/**
 * GET /api/interests
 *   tenant -> their interests (with listing + owner + score)
 *   owner  -> interests on their listings (with listing + tenant + score)
 */
export async function GET() {
  const auth = await requireRole();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();

  if (auth.profile.role === "tenant") {
    const { data } = await admin
      .from("interests")
      .select("*, listing:listings(*, owner:profiles(id,full_name,email))")
      .eq("tenant_id", auth.user.id)
      .order("created_at", { ascending: false });

    const rows = data ?? [];
    const scoreMap = await scoresFor(
      admin,
      rows.map((r) => ({ tenant_id: auth.user.id, listing_id: r.listing_id as string }))
    );
    const interests = rows.map((r) => ({
      ...r,
      score: scoreMap.get(`${auth.user.id}:${r.listing_id}`) ?? null,
    }));
    return NextResponse.json({ interests });
  }

  // Owner: interests on my listings.
  const { data: myListings } = await admin
    .from("listings")
    .select("id")
    .eq("owner_id", auth.user.id);
  const listingIds = (myListings ?? []).map((l) => l.id as string);

  if (listingIds.length === 0) return NextResponse.json({ interests: [] });

  const { data } = await admin
    .from("interests")
    .select("*, listing:listings(*), tenant:profiles(id,full_name,email)")
    .in("listing_id", listingIds)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const scoreMap = await scoresFor(
    admin,
    rows.map((r) => ({ tenant_id: r.tenant_id as string, listing_id: r.listing_id as string }))
  );
  const interests = rows.map((r) => ({
    ...r,
    score: scoreMap.get(`${r.tenant_id}:${r.listing_id}`) ?? null,
  }));
  return NextResponse.json({ interests });
}

/** POST /api/interests — tenant expresses interest in a listing. */
export async function POST(request: Request) {
  const auth = await requireRole("tenant");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = interestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: listingRow } = await admin
    .from("listings")
    .select("*")
    .eq("id", parsed.data.listing_id)
    .maybeSingle();
  const listing = listingRow as Listing | null;

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.status !== "active") {
    return NextResponse.json({ error: "This listing is no longer available" }, { status: 400 });
  }

  // Ensure the compatibility score exists (cached).
  const score = await getOrComputeScore(auth.user.id, listing.id);

  // Idempotent: don't create duplicate interest or re-notify.
  const { data: existing } = await admin
    .from("interests")
    .select("id")
    .eq("tenant_id", auth.user.id)
    .eq("listing_id", listing.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyExists: true, score: score.score });
  }

  const { error } = await admin.from("interests").insert({
    tenant_id: auth.user.id,
    listing_id: listing.id,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Notify the owner when a high-compatibility tenant expresses interest.
  if (score.score > HIGH_SCORE_THRESHOLD) {
    const { data: owner } = await admin
      .from("profiles")
      .select("full_name,email")
      .eq("id", listing.owner_id)
      .maybeSingle();
    if (owner?.email) {
      const tpl = highScoreInterestEmail({
        ownerName: owner.full_name,
        tenantName: auth.profile.full_name,
        listingTitle: listing.title,
        score: score.score,
      });
      await sendEmail({ to: owner.email, ...tpl });
    }
  }

  return NextResponse.json({ ok: true, score: score.score });
}

/** Fetch scores for a set of (tenant, listing) pairs and index them. */
async function scoresFor(
  admin: ReturnType<typeof createAdminClient>,
  pairs: Array<{ tenant_id: string; listing_id: string }>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (pairs.length === 0) return map;
  const tenantIds = [...new Set(pairs.map((p) => p.tenant_id))];
  const listingIds = [...new Set(pairs.map((p) => p.listing_id))];
  const { data } = await admin
    .from("compatibility_scores")
    .select("tenant_id,listing_id,score")
    .in("tenant_id", tenantIds)
    .in("listing_id", listingIds);
  for (const row of data ?? []) {
    map.set(`${row.tenant_id}:${row.listing_id}`, row.score as number);
  }
  return map;
}
