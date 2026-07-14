import { requirePage } from "@/lib/auth";
import { OwnerListings } from "@/components/OwnerListings";

export default async function OwnerListingsPage() {
  await requirePage("owner");
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Your listings</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Post rooms and manage their status. Filled listings are hidden from tenant search.
      </p>
      <OwnerListings />
    </div>
  );
}
