"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorNote } from "@/components/ui";
import { post } from "@/lib/client";
import { formatTime, formatWhen } from "@/lib/time";

export type MyRequestRow = {
  id: string;
  carId: string;
  carName: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
  startAt: Date;
  endAt: Date;
  note: string | null;
  decisionNote: string | null;
};

const TONE: Record<string, { label: string; className: string }> = {
  pending: { label: "Waiting for approval", className: "text-reserved" },
  approved: { label: "Approved", className: "text-available" },
  rejected: { label: "Rejected", className: "text-in-use" },
};

/**
 * "Submitting shows a clear waiting-for-approval state" (SPEC §5.3) — kept on
 * the garage screen so it is the first thing the requester sees, and the only
 * place a rejection reaches them until push arrives in M3.
 */
export function MyRequests({ rows, now }: { rows: MyRequestRow[]; now: Date }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancel(id: string) {
    setError(null);
    setBusy(id);
    try {
      await post(`/api/bookings/${id}/cancel`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel that.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <section aria-label="Your requests" className="space-y-2">
      <h2 className="text-sm font-semibold text-muted">Your requests</h2>

      <Card className="space-y-3">
        {rows.map((row) => {
          const tone = TONE[row.status];
          return (
            <div key={row.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {row.carName}{" "}
                  <span className="font-normal text-muted">
                    {formatWhen(row.startAt, now)} – {formatTime(row.endAt)}
                  </span>
                </p>
                <p className={tone?.className ?? "text-muted"}>
                  {tone?.label ?? row.status}
                  {row.status === "rejected" && row.decisionNote && ` · ${row.decisionNote}`}
                </p>
                {row.note && <p className="truncate text-muted">{row.note}</p>}
              </div>

              {row.status !== "rejected" && (
                <Button
                  variant="ghost"
                  className="shrink-0 px-2 text-xs"
                  disabled={busy === row.id}
                  onClick={() => cancel(row.id)}
                >
                  Cancel
                </Button>
              )}
            </div>
          );
        })}

        <ErrorNote>{error}</ErrorNote>
      </Card>
    </section>
  );
}
