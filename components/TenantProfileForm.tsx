"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";

interface FormState {
  preferred_location: string;
  budget_min: string;
  budget_max: string;
  move_in_date: string;
}

const EMPTY: FormState = {
  preferred_location: "",
  budget_min: "",
  budget_max: "",
  move_in_date: "",
};

export function TenantProfileForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant-profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setForm({
            preferred_location: d.profile.preferred_location ?? "",
            budget_min: String(d.profile.budget_min ?? ""),
            budget_max: String(d.profile.budget_max ?? ""),
            move_in_date: d.profile.move_in_date ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function update(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/tenant-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferred_location: form.preferred_location,
        budget_min: Number(form.budget_min),
        budget_max: Number(form.budget_max),
        move_in_date: form.move_in_date || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(json.error ?? "Could not save");
      return;
    }
    setMessage("Saved. Taking you to your matches…");
    router.push("/browse");
    router.refresh();
  }

  if (loading) {
    return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Preferred location">
          <Input
            placeholder="e.g. Koramangala, Bangalore"
            value={form.preferred_location}
            onChange={(e) => update("preferred_location", e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min budget (₹)">
            <Input
              type="number"
              min={0}
              value={form.budget_min}
              onChange={(e) => update("budget_min", e.target.value)}
              required
            />
          </Field>
          <Field label="Max budget (₹)">
            <Input
              type="number"
              min={0}
              value={form.budget_max}
              onChange={(e) => update("budget_max", e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Move-in date (optional)">
          <Input
            type="date"
            value={form.move_in_date}
            onChange={(e) => update("move_in_date", e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-neutral-700">{message}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </Card>
  );
}
