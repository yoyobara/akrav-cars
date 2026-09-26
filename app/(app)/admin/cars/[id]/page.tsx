import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarForm } from "@/components/CarForm";
import { db } from "@/lib/db";
import { cars } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditCarPage({ params }: PageProps<"/admin/cars/[id]">) {
  await requireAdmin();
  const { id } = await params;

  const car = await db.query.cars.findFirst({ where: eq(cars.id, id) });
  if (!car) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/cars" className="text-sm text-accent">
        ← Cars
      </Link>
      <h1 className="text-2xl font-bold">{car.nickname}</h1>
      <CarForm car={car} />
    </div>
  );
}
