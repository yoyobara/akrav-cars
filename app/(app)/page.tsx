import { CarCard } from "@/components/CarCard";
import { MyRequests } from "@/components/MyRequests";
import { TodayStrip } from "@/components/TodayStrip";
import { ButtonLink, Empty } from "@/components/ui";
import { getGarage, getMyBookings, getSchedule, myCoverage } from "@/lib/queries";
import { requireUser } from "@/lib/session";

/** Always current: the whole point is to answer "can I use a car right now". */
export const dynamic = "force-dynamic";

export default async function GaragePage() {
  const user = await requireUser();
  const now = new Date();

  const [garage, schedule, mine] = await Promise.all([
    getGarage(now),
    getSchedule(now, new Date(now.getTime() + 12 * 3_600_000)),
    getMyBookings(user.id, now),
  ]);
  const coverage = await myCoverage(
    user.id,
    garage.map((v) => v.car.id),
    now,
  );

  if (garage.length === 0) {
    return (
      <Empty title="No cars yet">
        {user.role === "admin" ? (
          <span className="mt-3 block">
            <ButtonLink href="/admin/cars/new">Add the first car</ButtonLink>
          </span>
        ) : (
          "Ask an admin to add the family cars."
        )}
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {garage.map((view) => (
          <CarCard
            key={view.car.id}
            view={view}
            userId={user.id}
            coverage={coverage[view.car.id]}
            now={now}
          />
        ))}
      </div>

      <MyRequests
        rows={mine.map((b) => ({
          id: b.id,
          carId: b.carId,
          carName: b.car.nickname,
          status: b.status,
          startAt: b.startAt,
          endAt: b.endAt,
          note: b.note,
          decisionNote: b.decisionNote,
        }))}
        now={now}
      />

      <TodayStrip cars={garage.map((v) => v.car)} bookings={schedule} now={now} />
    </div>
  );
}
