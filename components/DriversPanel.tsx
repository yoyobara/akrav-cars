"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, ErrorNote } from "@/components/ui";
import { api } from "@/lib/client";

type Member = { id: string; name: string; avatarUrl: string | null };

/**
 * Who the car's insurance covers: anyone, or the people named on the policy.
 * Everyone else needs temporary insurance for the window they want it.
 */
export function DriversPanel({
  carId,
  members,
  anyDriver: initialAnyDriver,
  named: initialNamed,
}: {
  carId: string;
  members: Member[];
  anyDriver: boolean;
  named: string[];
}) {
  const router = useRouter();
  const [anyDriver, setAnyDriver] = useState(initialAnyDriver);
  const [named, setNamed] = useState(() => new Set(initialNamed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSaved(false);
    setNamed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/cars/${carId}/drivers`, {
        method: "PUT",
        body: JSON.stringify({ anyDriver, userIds: [...named] }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save who can drive.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={anyDriver}
          onChange={(e) => {
            setSaved(false);
            setAnyDriver(e.target.checked);
          }}
        />
        The policy covers any driver
      </label>

      {!anyDriver && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Named on the policy. Anyone else needs temporary insurance before they can take it.
          </p>
          {members.map((m) => (
            <label key={m.id} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-4"
                checked={named.has(m.id)}
                onChange={() => toggle(m.id)}
              />
              <Avatar name={m.name} url={m.avatarUrl} size={28} />
              <span className="font-medium">{m.name}</span>
            </label>
          ))}
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>
      <Button variant="secondary" className="w-full" disabled={busy} onClick={save}>
        {busy ? "Saving…" : saved ? "Saved" : "Save who can drive"}
      </Button>
    </div>
  );
}
