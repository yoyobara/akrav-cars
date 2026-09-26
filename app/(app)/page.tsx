import { CarCard } from "@/components/CarCard";
import { TodayStrip } from "@/components/TodayStrip";
import { ButtonLink, Empty } from "@/components/ui";
import { getGarage, getSchedule } from "@/lib/queries";
import { requireUser } from "@/lib/session";

/** Always current: the whole point is to answer "can I use a car right now". */
export const dynamic = "force-dynamic";

export default async function GaragePage() {
  const user = await requireUser();
  const now = new Date();

  const [garage, schedule] = await Promise.all([
    getGarage(now),
    getSchedule(now, new Date(now.getTime() + 12 * 3_600_000)),
  ]);

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
          <CarCard key={view.car.id} view={view} userId={user.id} now={now} />
        ))}
      </div>

      <TodayStrip cars={garage.map((v) => v.car)} bookings={schedule} now={now} />
    </div>
  );
}
