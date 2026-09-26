import Link from "next/link";
import { CarForm } from "@/components/CarForm";
import { requireAdmin } from "@/lib/session";

export default async function NewCarPage() {
  await requireAdmin();

  return (
    <div className="space-y-4">
      <Link href="/admin/cars" className="text-sm text-accent">
        ← Cars
      </Link>
      <h1 className="text-2xl font-bold">Add a car</h1>
      <CarForm />
    </div>
  );
}
