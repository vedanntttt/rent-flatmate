import { requirePage } from "@/lib/auth";
import { OwnerInterests } from "@/components/OwnerInterests";

export default async function OwnerInterestsPage() {
  const { user } = await requirePage("owner");
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Interest requests</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Review tenants interested in your rooms. Accept to unlock real-time chat.
      </p>
      <OwnerInterests currentUserId={user.id} />
    </div>
  );
}
