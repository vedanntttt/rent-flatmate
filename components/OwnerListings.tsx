"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { formatDate, formatRent } from "@/lib/utils";
import type { Listing } from "@/lib/types";

const ROOM_TYPES = ["private", "shared", "studio", "1BHK", "2BHK"];
const FURNISHING = ["furnished", "semi-furnished", "unfurnished"];

const EMPTY_FORM = {
  title: "",
  description: "",
  location: "",
  rent: "",
  available_from: "",
  room_type: "private",
  furnishing_status: "unfurnished",
  photos: "",
};

export function OwnerListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/listings?mine=1");
    const json = await res.json();
    setListings(json.listings ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createListing(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const photos = form.photos
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        location: form.location,
        rent: Number(form.rent),
        available_from: form.available_from || null,
        room_type: form.room_type,
        furnishing_status: form.furnishing_status,
        photos,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create listing");
      return;
    }
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    load();
  }

  async function setStatus(id: string, status: "active" | "filled") {
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ New listing"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={createListing} className="space-y-4">
            <Field label="Title">
              <Input
                placeholder="Sunny private room near metro"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
              />
            </Field>
            <Field label="Description (optional)">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Location">
                <Input
                  placeholder="Koramangala, Bangalore"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  required
                />
              </Field>
              <Field label="Rent (₹ / month)">
                <Input
                  type="number"
                  min={0}
                  value={form.rent}
                  onChange={(e) => update("rent", e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Room type">
                <Select
                  value={form.room_type}
                  onChange={(e) => update("room_type", e.target.value)}
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Furnishing">
                <Select
                  value={form.furnishing_status}
                  onChange={(e) => update("furnishing_status", e.target.value)}
                >
                  {FURNISHING.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Available from">
                <Input
                  type="date"
                  value={form.available_from}
                  onChange={(e) => update("available_from", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Photo URLs (comma-separated, optional)">
              <Input
                placeholder="https://…/room1.jpg, https://…/room2.jpg"
                value={form.photos}
                onChange={(e) => update("photos", e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Publishing…" : "Publish listing"}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Card className="p-6 text-sm text-neutral-500">Loading…</Card>
      ) : listings.length === 0 ? (
        <Card className="p-6 text-sm text-neutral-500">
          No listings yet. Create your first one above.
        </Card>
      ) : (
        <div className="grid gap-4">
          {listings.map((l) => (
            <Card key={l.id} className="flex items-start justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{l.title}</h3>
                  <Badge
                    className={
                      l.status === "filled"
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : ""
                    }
                  >
                    {l.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                  {l.location} · {formatRent(l.rent)}/mo · {l.room_type} ·{" "}
                  {l.furnishing_status}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Available {formatDate(l.available_from)}
                </p>
              </div>
              <div className="shrink-0">
                {l.status === "active" ? (
                  <Button variant="outline" size="sm" onClick={() => setStatus(l.id, "filled")}>
                    Mark filled
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setStatus(l.id, "active")}>
                    Reactivate
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
