import { requirePage } from "@/lib/auth";
import { TenantInterests } from "@/components/TenantInterests";

export default async function TenantInterestsPage() {
  const { user } = await requirePage("tenant");
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">My interests</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Track requests you&apos;ve sent. Chat unlocks once an owner accepts.
      </p>
      <TenantInterests currentUserId={user.id} />
    </div>
  );
}
