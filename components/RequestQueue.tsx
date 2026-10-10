"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, Card, ErrorNote, inputClass } from "@/components/ui";
import { post } from "@/lib/client";
import { formatRelative, formatTime, formatWhen } from "@/lib/time";

type Conflict = { userName: string; startAt: Date; endAt: Date };

export type QueuedRequest = {
  id: string;
  carName: string;
  userName: string;
  avatarUrl: string | null;
  startAt: Date;
  endAt: Date;
  note: string | null;
  createdAt: Date;
  expired: boolean;
  /** The requester is covered on the car for the whole window. */
  insured: boolean;
  conflicts: Conflict[];
};

type BulkResult = {
  approved: string[];
  skipped: { id: string; code: string; message: string }[];
};

/** Can be decided in one tap, with nothing standing in the way. */
const isClean = (r: QueuedRequest) => r.conflicts.length === 0 && !r.expired && r.insured;

/** SPEC §5.5 — the queue, newest first, with approve / reject per row. */
export function RequestQueue({ requests, now }: { requests: QueuedRequest[]; now: Date }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Per-row failures, so one clash does not hide the rest of the queue. */
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const clean = requests.filter(isClean);

  async function decide(id: string, path: "approve" | "reject", body?: unknown) {
    setError(null);
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    setBusy(id);
    try {
      await post(`/api/bookings/${id}/${path}`, body);
      router.refresh();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Could not save that decision.",
      }));
    } finally {
      setBusy(null);
    }
  }

  async function approveAll() {
    setError(null);
    setRowErrors({});
    setBusy("bulk");
    try {
      const result = await post<BulkResult>("/api/bookings/approve-many", {
        ids: clean.map((r) => r.id),
      });
      if (result.skipped.length > 0) {
        setRowErrors(Object.fromEntries(result.skipped.map((s) => [s.id, s.message])));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve those requests.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {clean.length > 1 && (
        <Button variant="secondary" className="w-full" disabled={busy !== null} onClick={approveAll}>
          {busy === "bulk" ? "Approving…" : `Approve all ${clean.length} with no clash`}
        </Button>
      )}

      <ErrorNote>{error}</ErrorNote>

      {requests.map((request) => (
        <Row
          key={request.id}
          request={request}
          now={now}
          busy={busy === request.id || busy === "bulk"}
          error={rowErrors[request.id]}
          onApprove={(insure) => decide(request.id, "approve", { insure })}
          onReject={(reason) => decide(request.id, "reject", { reason: reason || null })}
        />
      ))}
    </div>
  );
}

function Row({
  request,
  now,
  busy,
  error,
  onApprove,
  onReject,
}: {
  request: QueuedRequest;
  now: Date;
  busy: boolean;
  error?: string;
  onApprove: (insure: boolean) => void;
  onReject: (reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [insuring, setInsuring] = useState(false);
  const when = `${formatWhen(request.startAt, now)} – ${formatTime(request.endAt)}`;
  const [reason, setReason] = useState("");

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={request.userName} url={request.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {request.userName} · {request.carName}
          </p>
          <p className="text-sm text-muted">{when}</p>
          {request.note && <p className="mt-1 text-sm">{request.note}</p>}
          <p className="mt-0.5 text-xs text-muted">
            asked {formatRelative(request.createdAt, now)}
          </p>
        </div>
      </div>

      {request.expired && (
        <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted">
          This window has already passed — it can only be rejected now.
        </p>
      )}

      {request.conflicts.map((c, i) => (
        <p key={i} className="rounded-xl bg-in-use/10 px-3 py-2 text-sm text-in-use">
          Clashes with {c.userName} {formatTime(c.startAt)}–{formatTime(c.endAt)} — reject that one
          first?
        </p>
      ))}

      {!request.insured && !request.expired && (
        <p className="rounded-xl bg-reserved/10 px-3 py-2 text-sm text-reserved">
          {request.userName} is not insured on {request.carName} for this window — it needs
          temporary insurance before it can be approved.
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>

      {insuring ? (
        <div className="space-y-2">
          <p className="text-sm">
            Only once you have actually arranged temporary insurance for {request.userName} on{" "}
            {request.carName}, {when}. It is recorded here for exactly that window.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setInsuring(false)}>
              Back
            </Button>
            <Button disabled={busy} onClick={() => onApprove(true)}>
              {busy ? "Saving…" : "Insured — approve"}
            </Button>
          </div>
        </div>
      ) : rejecting ? (
        <div className="space-y-2">
          <input
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (optional)"
            maxLength={300}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>
              Back
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => onReject(reason)}>
              {busy ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          {request.insured || request.expired ? (
            <Button disabled={busy || request.expired} onClick={() => onApprove(false)}>
              {busy ? "Saving…" : "Approve"}
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => setInsuring(true)}>
              Add insurance &amp; approve
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
