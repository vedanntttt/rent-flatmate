"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate, formatRent } from "@/lib/utils";
import type { Listing, Profile } from "@/lib/types";

interface Stats {
  users: number;
  owners: number;
  tenants: number;
  listings: number;
  activeListings: number;
  filledListings: number;
  interests: number;
  accepted: number;
  pending: number;
  messages: number;
  llmScores: number;
  ruleScores: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin");
    const json = await res.json();
    setStats(json.stats ?? null);
    setUsers(json.users ?? []);
    setListings(json.listings ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function del(action: "delete_listing" | "delete_user", id: string) {
    await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    load();
  }

  if (loading || !stats)
    return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;

  const tiles: Array<[string, number | string]> = [
    ["Users", stats.users],
    ["Owners", stats.owners],
    ["Tenants", stats.tenants],
    ["Listings", stats.listings],
    ["Active", stats.activeListings],
    ["Filled", stats.filledListings],
    ["Interests", stats.interests],
    ["Accepted", stats.accepted],
    ["Messages", stats.messages],
    ["LLM scores", stats.llmScores],
    ["Rule scores", stats.ruleScores],
    ["Pending", stats.pending],
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
              {label}
            </div>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Users
        </h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{u.email ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {u.role !== "admin" && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => del("delete_user", u.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Listings
        </h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Rent</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">{l.title}</td>
                  <td className="px-4 py-2 text-neutral-600">{l.location}</td>
                  <td className="px-4 py-2">{formatRent(l.rent)}</td>
                  <td className="px-4 py-2">
                    <Badge>{l.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => del("delete_listing", l.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
