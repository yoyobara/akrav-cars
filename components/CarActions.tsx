import { StartTripButton } from "@/components/StartTripButton";
import { TakeCarButton } from "@/components/TakeCarButton";
import { ButtonLink } from "@/components/ui";
import { START_GRACE_BEFORE_MIN } from "@/lib/constants";
import type { CarDetail } from "@/lib/queries";
import { formatWhen } from "@/lib/time";

/** The contextual primary action on the car detail screen (SPEC §5.2). */
export function CarActions({
  detail,
  userId,
  isAdmin,
  now,
}: {
  detail: CarDetail;
  userId: string;
  isAdmin: boolean;
  now: Date;
}) {
  const { car, active, upcoming } = detail;

  if (active) {
    if (active.userId === userId) {
      return (
        <ButtonLink href={`/cars/${car.id}/end-trip`} className="w-full">
          End trip &amp; report parking
        </ButtonLink>
      );
    }

    // An admin can close a trip someone forgot about, giving the location
    // themselves (SPEC §4).
    return isAdmin ? (
      <ButtonLink href={`/cars/${car.id}/end-trip`} variant="danger" className="w-full">
        End {active.user.name}’s trip
      </ButtonLink>
    ) : null;
  }

  const mineNext = upcoming.find((b) => b.userId === userId);
  if (mineNext) {
    const openYet = mineNext.startAt.getTime() - START_GRACE_BEFORE_MIN * 60_000 <= now.getTime();
    return openYet ? (
      <StartTripButton bookingId={mineNext.id} />
    ) : (
      <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-center text-sm text-muted">
        Yours from {formatWhen(mineNext.startAt, now)}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <TakeCarButton carId={car.id} />
      <ButtonLink href={`/cars/${car.id}/park`} variant="ghost" className="w-full">
        Just moved it? Report where it is
      </ButtonLink>
    </div>
  );
}
