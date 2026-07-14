"use client";

import { useEffect, useState } from "react";
import { Badge, Card, ScoreBadge } from "@/components/ui";
import { Chat } from "@/components/Chat";
import { formatRent } from "@/lib/utils";
import type { InterestStatus, Listing, Profile } from "@/lib/types";

interface TenantInterestRow {
  id: string;
  status: InterestStatus;
  score: number | null;
  listing: Listing & { owner: Pick<Profile, "id" | "full_name"> | null };
}

const STATUS_STYLES: Record<InterestStatus, string> = {
  pending: "",
  accepted: "border-neutral-900 bg-neutral-900 text-white",
  declined: "border-neutral-300 text-neutral-500",
};

export function TenantInterests({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<TenantInterestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/interests")
      .then((r) => r.json())
      .then((d) => setRows(d.interests ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;
  if (rows.length === 0)
    return (
      <Card className="p-6 text-sm text-neutral-500">
        You haven&apos;t expressed interest in any listings yet.
      </Card>
    );

  return (
    <div className="grid gap-4">
      {rows.map((i) => (
        <Card key={i.id} className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">{i.listing.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">
                {i.listing.location} · {formatRent(i.listing.rent)}/mo
              </p>
              {i.listing.owner?.full_name && (
                <p className="mt-0.5 text-xs text-neutral-500">
                  Owner: {i.listing.owner.full_name}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {i.score != null && <ScoreBadge score={i.score} />}
              <Badge className={STATUS_STYLES[i.status]}>{i.status}</Badge>
            </div>
          </div>

          {i.status === "accepted" ? (
            <Chat interestId={i.id} currentUserId={currentUserId} />
          ) : i.status === "declined" ? (
            <p className="mt-3 text-sm text-neutral-500">
              This request was declined.
            </p>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              Waiting for the owner to respond…
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
