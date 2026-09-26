import { RequestQueue } from "@/components/RequestQueue";
import { Empty } from "@/components/ui";
import { getPendingRequests } from "@/lib/queries";
import { requireAdminPage } from "@/lib/session";

export const dynamic = "force-dynamic";

/** SPEC §5.5 — the admin inbox. */
export default async function InboxPage() {
  await requireAdminPage();
  const now = new Date();
  const pending = await getPendingRequests(now);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Requests</h1>
        {pending.length > 0 && (
          <span className="text-sm text-muted">
            {pending.length} waiting
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <Empty title="Nothing waiting">
          Requests from the family land here. Anyone claiming a car that is free right now does
          not need you.
        </Empty>
      ) : (
        <RequestQueue
          requests={pending.map((r) => ({
            id: r.id,
            carName: r.car.nickname,
            userName: r.user.name,
            avatarUrl: r.user.avatarUrl,
            startAt: r.startAt,
            endAt: r.endAt,
            note: r.note,
            createdAt: r.createdAt,
            expired: r.expired,
            conflicts: r.conflicts.map((c) => ({
              userName: c.user.name,
              startAt: c.startAt,
              endAt: c.endAt,
            })),
          }))}
          now={now}
        />
      )}
    </div>
  );
}
