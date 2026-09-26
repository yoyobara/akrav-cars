import { asc } from "drizzle-orm";
import Link from "next/link";
import { ButtonLink, Card, Empty } from "@/components/ui";
import { db } from "@/lib/db";
import { cars } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminCarsPage() {
  await requireAdminPage();
  const all = await db.select().from(cars).orderBy(asc(cars.nickname));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Cars</h1>
        <ButtonLink href="/admin/cars/new">Add car</ButtonLink>
      </div>

      {all.length === 0 ? (
        <Empty title="No cars yet">Add the family cars so everyone can see them.</Empty>
      ) : (
        <div className="space-y-2">
          {all.map((car) => (
            <Card key={car.id}>
              <Link href={`/admin/cars/${car.id}`} className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">
                  {car.nickname}
                  {!car.isActive && <span className="font-normal text-muted"> · archived</span>}
                </span>
                <span className="text-sm text-muted">
                  {[car.make, car.model, car.plate].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
