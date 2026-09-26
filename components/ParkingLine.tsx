import type { ParkingView } from "@/lib/queries";
import { formatRelative } from "@/lib/time";

/** "📍 Rothschild 12 · level -1 — parked 2h ago by Noa" (SPEC §5.1). */
export function ParkingLine({
  parking,
  prefix = "",
}: {
  parking: ParkingView | null;
  prefix?: string;
}) {
  if (!parking) {
    return <p className="text-sm text-muted">No parking reported yet.</p>;
  }

  const where = parking.addressCached ?? (parking.lat != null ? "Pin on the map" : "Location unknown");

  return (
    <div className="text-sm">
      <p className="font-medium">
        <span aria-hidden>📍 </span>
        {prefix}
        {where}
        {parking.note && <span className="font-normal text-muted"> · {parking.note}</span>}
      </p>
      <p className="text-muted">
        parked {formatRelative(parking.createdAt)} by {parking.reportedBy.name}
      </p>
    </div>
  );
}
