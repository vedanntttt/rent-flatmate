import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BrowseListings } from "@/components/BrowseListings";
import { Card } from "@/components/ui";

export default async function BrowsePage() {
  const { user } = await requirePage("tenant");

  // Nudge the tenant to complete their profile so scoring is meaningful.
  const admin = createAdminClient();
  const { data: tp } = await admin
    .from("tenant_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Browse rooms</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Ranked by AI compatibility with your preferences.
      </p>

      {!tp && (
        <Card className="mb-6 border-neutral-900 p-4 text-sm">
          Add your preferences to get compatibility scores.{" "}
          <Link href="/tenant/profile" className="font-medium underline">
            Complete your profile →
          </Link>
        </Card>
      )}

      <BrowseListings />
    </div>
  );
}
