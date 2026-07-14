import { requirePage } from "@/lib/auth";
import { AdminDashboard } from "@/components/AdminDashboard";

export default async function AdminPage() {
  await requirePage("admin");
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Platform activity, users, and listings.
      </p>
      <AdminDashboard />
    </div>
  );
}
