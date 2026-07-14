import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageSchema } from "@/lib/validation";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Return the interest if the user is a participant, else null. */
async function participantInterest(
  admin: AdminClient,
  interestId: string,
  userId: string
) {
  const { data } = await admin
    .from("interests")
    .select("id,status,tenant_id, listing:listings(owner_id,title)")
    .eq("id", interestId)
    .maybeSingle();
  if (!data) return null;
  const listing = data.listing as unknown as { owner_id: string; title: string };
  const isParticipant = data.tenant_id === userId || listing.owner_id === userId;
  return isParticipant ? { ...data, listing } : null;
}

/** GET /api/messages?interestId= — chat history for a conversation. */
export async function GET(request: NextRequest) {
  const auth = await requireRole();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const interestId = new URL(request.url).searchParams.get("interestId");
  if (!interestId) {
    return NextResponse.json({ error: "interestId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const interest = await participantInterest(admin, interestId, auth.user.id);
  if (!interest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await admin
    .from("messages")
    .select("*")
    .eq("interest_id", interestId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: data ?? [] });
}

/** POST /api/messages — send a message (only after the interest is accepted). */
export async function POST(request: Request) {
  const auth = await requireRole();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const admin = createAdminClient();
  const interest = await participantInterest(admin, parsed.data.interest_id, auth.user.id);
  if (!interest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (interest.status !== "accepted") {
    return NextResponse.json(
      { error: "Chat unlocks once the interest is accepted" },
      { status: 403 }
    );
  }

  const { data, error } = await admin
    .from("messages")
    .insert({
      interest_id: parsed.data.interest_id,
      sender_id: auth.user.id,
      content: parsed.data.content,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
}
