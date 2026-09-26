import type { CarStatusKind } from "@/lib/status";

const copy: Record<CarStatusKind, { label: string; dot: string; text: string }> = {
  available: { label: "Available", dot: "bg-available", text: "text-available" },
  reserved: { label: "Reserved", dot: "bg-reserved", text: "text-reserved" },
  in_use: { label: "In use", dot: "bg-in-use", text: "text-in-use" },
};

export function StatusPill({ status, label }: { status: CarStatusKind; label?: string }) {
  const c = copy[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${c.text}`}>
      <span className={`size-2.5 rounded-full ${c.dot}`} aria-hidden />
      {label ?? c.label}
    </span>
  );
}
