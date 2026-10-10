import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarForm } from "@/components/CarForm";
import { DriversPanel } from "@/components/DriversPanel";
import { InsurancePanel } from "@/components/InsurancePanel";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { cars, users } from "@/lib/db/schema";
import { currentTemporaryInsurance, namedDrivers, uninsuredBookings } from "@/lib/insurance";
import { requireAdminPage } from "@/lib/session";
import { formatTime, formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function EditCarPage({ params }: PageProps<"/admin/cars/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  const now = new Date();

  const car = await db.query.cars.findFirst({ where: eq(cars.id, id) });
  if (!car) notFound();

  const [members, named, insurance, uninsured] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name)),
    namedDrivers(id),
    currentTemporaryInsurance(id, now),
    uninsuredBookings(id, now),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link href="/admin/cars" className="text-sm text-accent">
          ← Cars
        </Link>
        <h1 className="text-2xl font-bold">{car.nickname}</h1>
      </div>

      {uninsured.length > 0 && (
        <div className="space-y-1 rounded-xl bg-in-use/10 px-3 py-2 text-sm text-in-use">
          {uninsured.map((b) => (
            <p key={b.id}>
              {b.active
                ? `${b.userName} is driving it right now without insurance cover`
                : `${b.userName}’s booking ${formatWhen(b.startAt, now)} – ${formatTime(b.endAt)} is not insured and cannot be started`}{" "}
              — add temporary insurance below, or cancel the booking.
            </p>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Who can drive it</h2>
        <Card>
          <DriversPanel carId={car.id} members={members} anyDriver={car.anyDriver} named={named} />
        </Card>
      </section>

      {!car.anyDriver && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Temporary insurance</h2>
          <Card>
            <InsurancePanel carId={car.id} members={members} rows={insurance} serverNow={now} />
          </Card>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Details</h2>
        <CarForm car={car} />
      </section>
    </div>
  );
}
