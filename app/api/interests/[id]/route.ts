import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { interestDecisionSchema } from "@/lib/validation";
import { interestDecisionEmail, sendEmail } from "@/lib/email";

/** PATCH /api/interests/[id] — owner accepts or declines a tenant's interest. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRole("owner");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = interestDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: interest } = await admin
    .from("interests")
    .select("*, listing:listings(*), tenant:profiles(id,full_name,email)")
    .eq("id", id)
    .maybeSingle();

  if (!interest) return NextResponse.json({ error: "Interest not found" }, { status: 404 });

  const listing = interest.listing as { owner_id: string; title: string };
  if (listing.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("interests")
    .update({ status: parsed.data.status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Notify the tenant of the decision.
  const tenant = interest.tenant as { full_name: string | null; email: string | null };
  if (tenant?.email) {
    const tpl = interestDecisionEmail({
      tenantName: tenant.full_name,
      listingTitle: listing.title,
      status: parsed.data.status,
    });
    await sendEmail({ to: tenant.email, ...tpl });
  }

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
