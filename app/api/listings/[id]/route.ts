import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Listing } from "@/lib/types";

/** PATCH /api/listings/[id] — owner edits a listing (e.g. mark as filled). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRole("owner");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if ((listing as Listing).owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Partial<Listing> = {};
  if (body.status === "active" || body.status === "filled") patch.status = body.status;
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.rent === "number") patch.rent = body.rent;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("listings")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listing: data });
}
