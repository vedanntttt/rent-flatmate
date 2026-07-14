"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, ScoreBadge } from "@/components/ui";
import { formatDate, formatRent } from "@/lib/utils";
import type { ListingWithScore } from "@/lib/types";

export function BrowseListings() {
  const [listings, setListings] = useState<ListingWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ location: "", minBudget: "", maxBudget: "" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.location) params.set("location", filters.location);
    if (filters.minBudget) params.set("minBudget", filters.minBudget);
    if (filters.maxBudget) params.set("maxBudget", filters.maxBudget);
    const res = await fetch(`/api/listings?${params.toString()}`);
    const json = await res.json();
    setListings(json.listings ?? []);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
    // Initial load only; filtering is triggered explicitly via the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function expressInterest(id: string) {
    setBusyId(id);
    const res = await fetch("/api/interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: id }),
    });
    setBusyId(null);
    if (res.ok) {
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, interest_status: "pending" } : l))
      );
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px_auto] sm:items-end">
          <Field label="Location">
            <Input
              placeholder="Any area"
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            />
          </Field>
          <Field label="Min ₹">
            <Input
              type="number"
              value={filters.minBudget}
              onChange={(e) => setFilters((f) => ({ ...f, minBudget: e.target.value }))}
            />
          </Field>
          <Field label="Max ₹">
            <Input
              type="number"
              value={filters.maxBudget}
              onChange={(e) => setFilters((f) => ({ ...f, maxBudget: e.target.value }))}
            />
          </Field>
          <Button onClick={load}>Search</Button>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 text-sm text-neutral-500">Scoring matches…</Card>
      ) : listings.length === 0 ? (
        <Card className="p-6 text-sm text-neutral-500">
          No active listings match your filters.
        </Card>
      ) : (
        <div className="grid gap-4">
          {listings.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{l.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {l.location} · {formatRent(l.rent)}/mo · {l.room_type} ·{" "}
                    {l.furnishing_status}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Available {formatDate(l.available_from)}
                  </p>
                </div>
                {l.score != null && <ScoreBadge score={l.score} method={l.method} />}
              </div>

              {l.description && (
                <p className="mt-3 text-sm text-neutral-700">{l.description}</p>
              )}

              {l.explanation && (
                <div className="mt-3 rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
                  <span className="font-medium">Why this match: </span>
                  {l.explanation}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                {l.photos && l.photos.length > 0 ? (
                  <span className="text-xs text-neutral-500">
                    {l.photos.length} photo{l.photos.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span />
                )}
                {l.interest_status ? (
                  <Badge>Interest {l.interest_status}</Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={busyId === l.id}
                    onClick={() => expressInterest(l.id)}
                  >
                    {busyId === l.id ? "Sending…" : "Express interest"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
