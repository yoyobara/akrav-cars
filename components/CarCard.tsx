import Link from "next/link";
import { InsuranceNote, insuredNow } from "@/components/InsuranceNote";
import { StartTripButton } from "@/components/StartTripButton";
import { StatusPill } from "@/components/StatusPill";
import { TakeCarButton } from "@/components/TakeCarButton";
import { ParkingLine } from "@/components/ParkingLine";
import { ButtonLink, Card } from "@/components/ui";
import type { CarView } from "@/lib/queries";
import { START_GRACE_BEFORE_MIN } from "@/lib/constants";
import type { Coverage } from "@/lib/coverage";
import { formatRelative, formatWhen } from "@/lib/time";

/** One card per car — the screen that answers everything (SPEC §5.1). */
export function CarCard({
  view,
  userId,
  coverage,
  now,
}: {
  view: CarView;
  userId: string;
  /** The viewer's insurance on this car. */
  coverage: Coverage;
  now: Date;
}) {
  const { car, status, active, next, parking } = view;
  const mine = active?.userId === userId;

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={`/cars/${car.id}`} className="text-lg font-bold">
          {car.nickname}
        </Link>
        <StatusPill
          status={status}
          label={
            status === "in_use"
              ? mine
                ? "You have it"
                : `${active!.user.name} has it`
              : undefined
          }
        />
      </div>

      {active && (
        <p className="text-sm text-muted">
          back ~{formatWhen(active.endAt, now)} ({formatRelative(active.endAt, now)})
        </p>
      )}

      {!active && next && (
        <p className="text-sm text-reserved">
          {next.userId === userId ? "Yours" : `${next.user.name}’s`} from {formatWhen(next.startAt, now)}
        </p>
      )}

      <ParkingLine parking={parking} prefix={status === "in_use" ? "last seen: " : ""} />

      {!mine && <InsuranceNote coverage={coverage} carName={car.nickname} now={now} />}

      <Action view={view} userId={userId} coverage={coverage} now={now} />
    </Card>
  );
}

function Action({
  view,
  userId,
  coverage,
  now,
}: {
  view: CarView;
  userId: string;
  coverage: Coverage;
  now: Date;
}) {
  const { car, status, active, next } = view;

  if (status === "in_use") {
    if (active!.userId === userId) {
      return (
        <ButtonLink href={`/cars/${car.id}/end-trip`} className="w-full">
          End trip &amp; report parking
        </ButtonLink>
      );
    }
    // SPEC §5.1 puts "Ask X for it" here, but asking is a notification and
    // notifications are M3, so the useful action while someone else has it is
    // to book it for later.
    return (
      <div className="space-y-2">
        <ButtonLink href={`/request?car=${car.id}`} variant="secondary" className="w-full">
          Request this car
        </ButtonLink>
        <ButtonLink href={`/cars/${car.id}`} variant="ghost" className="w-full">
          See details
        </ButtonLink>
      </div>
    );
  }

  // Reserved for me and within the grace window: one tap to take it.
  const startable =
    next?.userId === userId &&
    next.startAt.getTime() - START_GRACE_BEFORE_MIN * 60_000 <= now.getTime();
  if (startable) return <StartTripButton bookingId={next!.id} />;

  // Reserved for someone else: still takeable for a trip that fits in the gap.
  // A preset that would run into their booking is refused by the server with a
  // sentence naming who it clashes with.
  return (
    <div className="space-y-2">
      {status === "reserved" && (
        <p className="text-sm text-muted">
          {next!.user.name} needs it from {formatWhen(next!.startAt, now)}.
        </p>
      )}
      {/* Not insured: the one-tap claim would only be refused, so the way in
          is a request, which an admin approves with temporary insurance. */}
      {insuredNow(coverage, now) ? (
        <>
          <TakeCarButton carId={car.id} />
          <ButtonLink href={`/request?car=${car.id}`} variant="ghost" className="w-full">
            Book it for later
          </ButtonLink>
        </>
      ) : (
        <ButtonLink href={`/request?car=${car.id}`} variant="secondary" className="w-full">
          Request this car
        </ButtonLink>
      )}
    </div>
  );
}
