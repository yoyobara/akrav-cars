"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { post } from "@/lib/client";
import { Button, ErrorNote } from "@/components/ui";

type Preset = { label: string; minutes: number | "end-of-day" };

/** Quick presets from SPEC §5.3, trimmed to the ones that start now. */
const PRESETS: Preset[] = [
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
  { label: "Rest of the day", minutes: "end-of-day" },
];

function endFor(preset: Preset, now: Date): Date {
  if (preset.minutes !== "end-of-day") {
    return new Date(now.getTime() + preset.minutes * 60_000);
  }
  // 23:00 tonight, or an hour from now if it is already late.
  const end = new Date(now);
  end.setHours(23, 0, 0, 0);
  return end > now ? end : new Date(now.getTime() + 60 * 60_000);
}

/**
 * Claim and take the car in one tap: the booking is created already approved
 * (the car is free right now) and started in the same request.
 */
export function TakeCarButton({ carId, label = "Take the car" }: { carId: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function take(preset: Preset) {
    setError(null);
    const now = new Date();

    try {
      await post("/api/bookings", {
        carId,
        startAt: now.toISOString(),
        endAt: endFor(preset, now).toISOString(),
        startNow: true,
      });
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not take the car.");
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full">
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Back in about…</p>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="secondary"
            disabled={pending}
            onClick={() => take(p)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
