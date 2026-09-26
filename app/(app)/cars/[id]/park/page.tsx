import Link from "next/link";
import { notFound } from "next/navigation";
import { EndTripForm } from "@/components/EndTripForm";
import { getCarDetail, recentParkingNotes } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** A car was moved without a trip — report where it stands now (SPEC §8). */
export default async function ParkPage({ params }: PageProps<"/cars/[id]/park">) {
  await requireUser();
  const { id } = await params;

  const detail = await getCarDetail(id);
  if (!detail) notFound();

  const suggestions = await recentParkingNotes(id);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cars/${id}`} className="text-sm text-accent">
          ← {detail.car.nickname}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Report where it is parked</h1>
      </div>

      <EndTripForm
        endpoint={`/api/cars/${id}/parking`}
        asTripEnd={false}
        carNickname={detail.car.nickname}
        suggestions={suggestions}
        doneHref={`/cars/${id}`}
        submitLabel="Save location"
      />
    </div>
  );
}
