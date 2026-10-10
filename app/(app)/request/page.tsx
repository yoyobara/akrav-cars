import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { RequestForm } from "@/components/RequestForm";
import { Empty } from "@/components/ui";
import { db } from "@/lib/db";
import { cars } from "@/lib/db/schema";
import { getSchedule, myCoverage } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * How far ahead the sheet is told about other bookings. It only feeds the live
 * conflict hint, so a custom window past the horizon simply gets no hint — the
 * server still decides (SPEC §5.3).
 */
const HORIZON_DAYS = 30;

/** SPEC §5.3 — the request sheet. */
export default async function RequestPage({ searchParams }: PageProps<"/request">) {
  const user = await requireUser();
  const params = await searchParams;
  const preselect = typeof params.car === "string" ? params.car : undefined;
  const now = new Date();

  const [garage, schedule] = await Promise.all([
    db
      .select({ id: cars.id, nickname: cars.nickname })
      .from(cars)
      .where(eq(cars.isActive, true))
      .orderBy(asc(cars.nickname)),
    getSchedule(now, new Date(now.getTime() + HORIZON_DAYS * 86_400_000)),
  ]);
  const coverage = await myCoverage(
    user.id,
    garage.map((c) => c.id),
    now,
  );

  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="text-sm text-accent">
          ← Garage
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Request a car</h1>
      </div>

      {garage.length === 0 ? (
        <Empty title="No cars yet">Ask an admin to add the family cars.</Empty>
      ) : (
        <RequestForm
          cars={garage}
          slots={schedule.map((b) => ({
            id: b.id,
            carId: b.carId,
            userId: b.userId,
            status: b.status,
            startAt: b.startAt,
            endAt: b.endAt,
            active: b.actualStartAt !== null && b.actualEndAt === null,
            userName: b.user.name,
          }))}
          initialCarId={garage.some((c) => c.id === preselect) ? preselect : garage[0].id}
          isAdmin={user.role === "admin"}
          myId={user.id}
          coverage={coverage}
          serverNow={now}
        />
      )}
    </div>
  );
}
