"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { post } from "@/lib/client";
import { Button, ErrorNote } from "@/components/ui";
import { TAKE_PRESETS, type Preset } from "@/lib/presets";

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
    const { startAt, endAt } = preset.window(new Date());

    try {
      await post("/api/bookings", {
        carId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
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
        {TAKE_PRESETS.map((p) => (
          <Button key={p.id} variant="secondary" disabled={pending} onClick={() => take(p)}>
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
