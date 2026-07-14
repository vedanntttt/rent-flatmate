import { requirePage } from "@/lib/auth";
import { AccountCard } from "@/components/AccountCard";
import { TenantProfileForm } from "@/components/TenantProfileForm";

export default async function TenantProfilePage() {
  const { profile } = await requirePage("tenant");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Your profile</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Your account details and what you&apos;re looking for.
      </p>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Account
      </h2>
      <AccountCard
        initial={{
          full_name: profile.full_name,
          age: profile.age,
          email: profile.email,
        }}
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Preferences
      </h2>
      <p className="mb-3 text-sm text-neutral-600">
        We use these to score and rank listings for you.
      </p>
      <TenantProfileForm />
    </div>
  );
}
