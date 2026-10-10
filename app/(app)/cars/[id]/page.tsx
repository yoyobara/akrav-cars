import Link from "next/link";
import { notFound } from "next/navigation";
import { CarActions } from "@/components/CarActions";
import { Map } from "@/components/Map";
import { NavigateLinks } from "@/components/NavigateLinks";
import { StatusPill } from "@/components/StatusPill";
import { Avatar, Card } from "@/components/ui";
import { getCarDetail, myCoverage } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { formatRelative, formatTime, formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CarPage({ params }: PageProps<"/cars/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const now = new Date();

  const [detail, coverage] = await Promise.all([
    getCarDetail(id, now),
    myCoverage(user.id, [id], now),
  ]);
  if (!detail) notFound();

  const { car, status, active, parking, upcoming, recentTrips, parkingHistory } = detail;
  const holder = active?.userId === user.id;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">{car.nickname}</h1>
          <StatusPill
            status={status}
            label={status === "in_use" ? (holder ? "You have it" : `${active!.user.name} has it`) : undefined}
          />
        </div>
        <p className="text-sm text-muted">
          {[car.make, car.model, car.year, car.colour].filter(Boolean).join(" · ")}
          {car.plate && <span className="ms-2 font-mono">{car.plate}</span>}
        </p>
        {active && (
          <p className="text-sm text-muted">
            out since {formatTime(active.actualStartAt!)}, back ~{formatWhen(active.endAt, now)}
            {active.note && ` · ${active.note}`}
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Where it is</h2>

        {parking?.lat != null && parking.lng != null ? (
          <>
            <div className="h-56 overflow-hidden rounded-2xl border border-border">
              <Map
                lat={parking.lat}
                lng={parking.lng}
                accuracyM={parking.accuracyM}
                className="size-full"
              />
            </div>
            <div className="text-sm">
              <p className="font-medium">{parking.addressCached ?? "Pin on the map"}</p>
              {parking.note && <p className="text-muted">{parking.note}</p>}
              <p className="text-muted">
                reported by {parking.reportedBy.name} {formatRelative(parking.createdAt, now)}
                {parking.accuracyM ? ` · ±${Math.round(parking.accuracyM)} m` : ""}
              </p>
            </div>
            <NavigateLinks lat={parking.lat} lng={parking.lng} label={parking.addressCached} />
          </>
        ) : (
          <Card>
            <p className="text-sm">
              {parking?.note ?? "Nobody has reported where this car is parked yet."}
            </p>
            {parking && (
              <p className="mt-1 text-sm text-muted">
                {parking.reportedBy.name}, {formatRelative(parking.createdAt, now)}
              </p>
            )}
          </Card>
        )}
      </section>

      <CarActions
        detail={detail}
        userId={user.id}
        isAdmin={user.role === "admin"}
        coverage={coverage[id]}
        now={now}
      />

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Coming up</h2>
          <Card className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-sm">
                <Avatar name={b.user.name} url={b.user.avatarUrl} size={24} />
                <span className="font-medium">{b.user.name}</span>
                <span className="text-muted">
                  {formatWhen(b.startAt, now)} – {formatTime(b.endAt)}
                </span>
                {b.note && <span className="truncate text-muted">· {b.note}</span>}
              </div>
            ))}
          </Card>
        </section>
      )}

      {parkingHistory.length > 1 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Parking history</h2>
          <Card className="space-y-2">
            {parkingHistory.slice(1).map((p) => (
              <div key={p.id} className="text-sm">
                <span className="font-medium">
                  {p.addressCached ?? (p.lat != null ? "Pin on the map" : "Location unknown")}
                </span>
                {p.note && <span className="text-muted"> · {p.note}</span>}
                <span className="block text-muted">
                  {p.reportedBy.name}, {formatRelative(p.createdAt, now)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {recentTrips.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Recent trips</h2>
          <Card className="space-y-2">
            {recentTrips.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <Avatar name={t.user.name} url={t.user.avatarUrl} size={24} />
                <span className="font-medium">{t.user.name}</span>
                <span className="text-muted">
                  {formatWhen(t.actualStartAt ?? t.startAt, now)} –{" "}
                  {formatTime(t.actualEndAt ?? t.endAt)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {user.role === "admin" && (
        <Link href={`/admin/cars/${car.id}`} className="block text-center text-sm text-accent">
          Edit this car
        </Link>
      )}
    </div>
  );
}
