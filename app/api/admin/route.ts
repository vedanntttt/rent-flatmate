import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/admin — platform overview: users, listings, activity stats. */
export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();

  const [users, listings, interests, messages, scores] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("listings").select("*").order("created_at", { ascending: false }),
    admin.from("interests").select("id,status,created_at"),
    admin.from("messages").select("id", { count: "exact", head: true }),
    admin.from("compatibility_scores").select("method"),
  ]);

  const usersData = users.data ?? [];
  const listingsData = listings.data ?? [];
  const interestsData = interests.data ?? [];
  const scoresData = scores.data ?? [];

  const stats = {
    users: usersData.length,
    owners: usersData.filter((u) => u.role === "owner").length,
    tenants: usersData.filter((u) => u.role === "tenant").length,
    listings: listingsData.length,
    activeListings: listingsData.filter((l) => l.status === "active").length,
    filledListings: listingsData.filter((l) => l.status === "filled").length,
    interests: interestsData.length,
    accepted: interestsData.filter((i) => i.status === "accepted").length,
    pending: interestsData.filter((i) => i.status === "pending").length,
    messages: messages.count ?? 0,
    llmScores: scoresData.filter((s) => s.method === "llm").length,
    ruleScores: scoresData.filter((s) => s.method === "rule").length,
  };

  return NextResponse.json({ stats, users: usersData, listings: listingsData });
}

/** PATCH /api/admin — moderate: delete a listing or a user. */
export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const admin = createAdminClient();

  if (body?.action === "delete_listing" && body.id) {
    await admin.from("listings").delete().eq("id", body.id);
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "delete_user" && body.id) {
    await admin.auth.admin.deleteUser(body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
