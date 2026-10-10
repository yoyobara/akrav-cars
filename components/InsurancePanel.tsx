"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { api, post } from "@/lib/client";
import { formatWhen, fromPickerValue, toPickerValue } from "@/lib/time";

type Member = { id: string; name: string };

export type InsuranceRow = {
  id: string;
  userName: string;
  startAt: Date;
  endAt: Date;
  note: string | null;
  createdByName: string;
};

/**
 * Temporary insurance on one car: what is current or coming up, revoke, and
 * add a window for someone not on the policy. Record it once it is actually
 * arranged — the app keeps track of insurance, it does not buy it.
 */
export function InsurancePanel({
  carId,
  members,
  rows,
  serverNow,
}: {
  carId: string;
  members: Member[];
  rows: InsuranceRow[];
  serverNow: Date;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(members[0]?.id ?? "");
  const [start, setStart] = useState(() => toPickerValue(serverNow));
  const [end, setEnd] = useState(() => toPickerValue(new Date(serverNow.getTime() + 86_400_000)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAt = fromPickerValue(start);
  const endAt = fromPickerValue(end);
  const valid = !!userId && !!startAt && !!endAt && endAt > startAt;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setBusy("add");
    try {
      await post(`/api/cars/${carId}/insurance`, {
        userId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        note: note.trim() || null,
      });
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the insurance.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    setError(null);
    setBusy(id);
    try {
      await api(`/api/cars/${carId}/insurance/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the insurance.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No temporary insurance now or coming up.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{r.userName}</p>
                <p className="text-muted">
                  {formatWhen(r.startAt, serverNow)} – {formatWhen(r.endAt, serverNow)}
                  {r.note && ` · ${r.note}`}
                </p>
                <p className="text-xs text-muted">added by {r.createdByName}</p>
              </div>
              <Button
                variant="ghost"
                className="shrink-0 px-2 text-xs"
                disabled={busy !== null}
                onClick={() => revoke(r.id)}
              >
                {busy === r.id ? "Removing…" : "Remove"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="space-y-3 border-t border-border pt-3">
        <Field label="Who">
          <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <input
              type="datetime-local"
              className={inputClass}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </Field>
          <Field label="Until">
            <input
              type="datetime-local"
              className={inputClass}
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Note" hint="Optional — policy number, insurer.">
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
          />
        </Field>
        {!valid && start && end && (
          <p className="text-sm text-reserved">The end has to be after the start.</p>
        )}
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" disabled={busy !== null || !valid}>
          {busy === "add" ? "Adding…" : "Add temporary insurance"}
        </Button>
      </form>
    </div>
  );
}
