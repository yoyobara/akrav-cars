import type { BookingView } from "@/lib/queries";
import type { Car } from "@/lib/db/schema";
import { formatTime } from "@/lib/time";

const HOURS = 12;

/** Compact strip of every car's bookings for the next 12 hours (SPEC §5.1). */
export function TodayStrip({
  cars,
  bookings,
  now,
}: {
  cars: Car[];
  bookings: BookingView[];
  now: Date;
}) {
  if (bookings.length === 0) return null;

  const from = now.getTime();
  const to = from + HOURS * 3_600_000;
  const pct = (t: number) => ((Math.min(Math.max(t, from), to) - from) / (to - from)) * 100;

  return (
    <section aria-label="Next 12 hours" className="space-y-2">
      <h2 className="text-sm font-semibold text-muted">Next 12 hours</h2>

      <div className="space-y-1.5 rounded-2xl border border-border bg-surface p-3">
        {cars.map((car) => {
          const mine = bookings.filter((b) => b.carId === car.id);
          return (
            <div key={car.id} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-xs text-muted">{car.nickname}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-surface-muted">
                {mine.map((b) => {
                  const start = pct(b.startAt.getTime());
                  const width = Math.max(pct(b.endAt.getTime()) - start, 2);
                  return (
                    <span
                      key={b.id}
                      title={`${b.user.name} ${formatTime(b.startAt)}–${formatTime(b.endAt)}`}
                      className={`absolute inset-y-0 flex items-center overflow-hidden rounded-md px-1.5 text-[11px] font-medium text-white ${
                        b.status === "pending" ? "bg-muted/60 border border-dashed border-muted" : "bg-accent"
                      }`}
                      style={{ insetInlineStart: `${start}%`, width: `${width}%` }}
                    >
                      <span className="truncate">{b.user.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex justify-between pt-1 text-[11px] text-muted">
          <span>{formatTime(now)}</span>
          <span>{formatTime(new Date(to))}</span>
        </div>
      </div>
    </section>
  );
}
