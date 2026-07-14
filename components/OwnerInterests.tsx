"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ScoreBadge } from "@/components/ui";
import { Chat } from "@/components/Chat";
import { formatRent } from "@/lib/utils";
import type { InterestStatus, Listing, Profile } from "@/lib/types";

interface OwnerInterestRow {
  id: string;
  status: InterestStatus;
  score: number | null;
  listing: Listing;
  tenant: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export function OwnerInterests({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<OwnerInterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/interests");
    const json = await res.json();
    setRows(json.interests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, status: "accepted" | "declined") {
    setBusyId(id);
    await fetch(`/api/interests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    load();
  }

  if (loading) return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;
  if (rows.length === 0)
    return (
      <Card className="p-6 text-sm text-neutral-500">
        No interest requests yet.
      </Card>
    );

  return (
    <div className="grid gap-4">
      {rows.map((i) => (
        <Card key={i.id} className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{i.tenant?.full_name ?? "A tenant"}</h3>
                <Badge>{i.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                Interested in <span className="font-medium">{i.listing.title}</span> ·{" "}
                {i.listing.location} · {formatRent(i.listing.rent)}/mo
              </p>
              {i.tenant?.email && (
                <p className="mt-0.5 text-xs text-neutral-500">{i.tenant.email}</p>
              )}
            </div>
            {i.score != null && <ScoreBadge score={i.score} />}
          </div>

          {i.status === "pending" && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                disabled={busyId === i.id}
                onClick={() => decide(i.id, "accepted")}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busyId === i.id}
                onClick={() => decide(i.id, "declined")}
              >
                Decline
              </Button>
            </div>
          )}

          {i.status === "accepted" && (
            <Chat interestId={i.id} currentUserId={currentUserId} />
          )}
        </Card>
      ))}
    </div>
  );
}
