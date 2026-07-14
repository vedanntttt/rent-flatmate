import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation";

/**
 * Create a confirmed auth user + profile with the chosen role.
 * Using the admin API with email_confirm:true means no email round-trip is
 * needed for the demo — the client can sign in immediately afterwards.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password, full_name, role } = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create account" },
      { status: 400 }
    );
  }

  // Safety net if the on_auth_user_created trigger is not installed.
  await admin
    .from("profiles")
    .upsert(
      { id: data.user.id, role, full_name, email },
      { onConflict: "id", ignoreDuplicates: true }
    );

  return NextResponse.json({ ok: true, role });
}
