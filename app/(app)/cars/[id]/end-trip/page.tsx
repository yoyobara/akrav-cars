import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EndTripForm } from "@/components/EndTripForm";
import { getCarDetail, recentParkingNotes } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** SPEC §5.6 — two taps when GPS is good and no note is needed. */
export default async function EndTripPage({ params }: PageProps<"/cars/[id]/end-trip">) {
  const user = await requireUser();
  const { id } = await params;

  const detail = await getCarDetail(id);
  if (!detail) notFound();

  const active = detail.active;
  if (!active) redirect(`/cars/${id}`);

  const forceEnd = active.userId !== user.id;
  if (forceEnd && user.role !== "admin") redirect(`/cars/${id}`);

  const suggestions = await recentParkingNotes(id);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cars/${id}`} className="text-sm text-accent">
          ← {detail.car.nickname}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {forceEnd ? `End ${active.user.name}’s trip` : "Where did you leave it?"}
        </h1>
        {forceEnd && (
          <p className="text-sm text-muted">
            You are closing this trip for {active.user.name}, so the location comes from you.
          </p>
        )}
      </div>

      <EndTripForm
        endpoint={`/api/bookings/${active.id}/end`}
        asTripEnd={true}
        carNickname={detail.car.nickname}
        suggestions={suggestions}
        doneHref="/"
        submitLabel="Done"
      />
    </div>
  );
}
