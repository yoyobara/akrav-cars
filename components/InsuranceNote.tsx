import { isCovered, temporaryCoverUntil, type Coverage } from "@/lib/coverage";
import { formatWhen } from "@/lib/time";

/** Insured on the car this minute — enough to offer "Take the car". */
export function insuredNow(coverage: Coverage, now: Date): boolean {
  return isCovered(coverage, now, new Date(now.getTime() + 60_000));
}

/**
 * Where you stand on a car's insurance, said before you try: nothing when the
 * policy covers you, how long temporary insurance lasts, or that you need it.
 */
export function InsuranceNote({
  coverage,
  carName,
  now,
}: {
  coverage: Coverage;
  carName: string;
  now: Date;
}) {
  if (coverage.permanent) return null;

  const until = temporaryCoverUntil(coverage, now);
  if (until) {
    return (
      <p className="text-sm text-muted">Your temporary insurance runs until {formatWhen(until, now)}.</p>
    );
  }

  return (
    <p className="text-sm text-reserved">
      You are not on {carName}’s insurance. Request it, and an admin adds temporary insurance when
      approving.
    </p>
  );
}
