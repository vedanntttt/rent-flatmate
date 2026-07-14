import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { tenantProfileSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireRole("tenant");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({ profile: data ?? null });
}

export async function POST(request: Request) {
  const auth = await requireRole("tenant");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = tenantProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_profiles")
    .upsert(
      {
        user_id: auth.user.id,
        preferred_location: parsed.data.preferred_location,
        budget_min: parsed.data.budget_min,
        budget_max: parsed.data.budget_max,
        move_in_date: parsed.data.move_in_date || null,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Preferences changed -> invalidate cached scores so they recompute next browse.
  await admin.from("compatibility_scores").delete().eq("tenant_id", auth.user.id);

  return NextResponse.json({ profile: data });
}
