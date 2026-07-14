"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";

interface AccountInitial {
  full_name: string | null;
  age: number | null;
  email: string | null;
}

/** Read-only account summary with an Edit -> Save/Cancel flow for name and age. */
export function AccountCard({ initial }: { initial: AccountInitial }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.full_name ?? "");
  const [age, setAge] = useState(initial.age != null ? String(initial.age) : "");
  const [shown, setShown] = useState({ name: initial.full_name ?? "", age: initial.age });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: name.trim(),
        age: age === "" ? null : Number(age),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save");
      return;
    }
    setShown({ name: json.profile.full_name ?? "", age: json.profile.age });
    setEditing(false);
    // Refresh server components so the header picks up the new name.
    router.refresh();
  }

  function onCancel() {
    setName(shown.name);
    setAge(shown.age != null ? String(shown.age) : "");
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-neutral-500">Name</dt>
              <dd className="font-medium text-neutral-900">{shown.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Age</dt>
              <dd className="font-medium text-neutral-900">
                {shown.age != null ? shown.age : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Email</dt>
              <dd className="font-medium text-neutral-900">{initial.email ?? "—"}</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSave} className="space-y-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </Field>
        <Field label="Age (optional)">
          <Input
            type="number"
            min={16}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 24"
          />
        </Field>
        <p className="text-xs text-neutral-500">Email can&apos;t be changed: {initial.email}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
